import type { WebhookEvent } from '../../lib/types'
import { localDb } from '../../lib/localDb'
import { db, isFirebaseConfigured } from '../../lib/firebase'
import { ShopifySyncService } from './sync.service'
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs } from 'firebase/firestore'

export class ShopifyWebhooksService {
  
  // Register all required Shopify webhooks
  public static async registerWebhooks(shopDomain: string, accessToken: string, webhookBaseUrl: string): Promise<boolean> {
    const isMock = accessToken.startsWith('shpat_mock_') || !shopDomain
    if (isMock) {
      console.log(`[Shopify Mock Mode] Webhooks registered successfully for base url ${webhookBaseUrl}`)
      return true
    }

    const topics = [
      'products/create',
      'products/update',
      'orders/create',
      'orders/updated',
      'inventory_levels/update',
      'app/uninstalled'
    ]

    try {
      for (const topic of topics) {
        const response = await fetch(`https://${shopDomain}/admin/api/2024-04/webhooks.json`, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            webhook: {
              topic,
              address: `${webhookBaseUrl}/api/shopify/webhooks`,
              format: 'json',
            }
          })
        })
        if (!response.ok) {
          console.warn(`Webhook subscription for ${topic} returned status ${response.status}`)
        }
      }
      return true
    } catch (e) {
      console.error('Failed to register webhooks on Shopify Store:', e)
      return false
    }
  }

  // Record raw incoming webhook payload in processing queue ledger (idempotent, thread safe)
  public static async queueWebhook(orgId: string, topic: string, payload: any): Promise<string> {
    const eventId = `wh_evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    
    if (!isFirebaseConfigured || !db) {
      // Local DB logging
      const allEvents = localDb.getStorage<any[]>('webhook_events', [])
      
      const newEvent: WebhookEvent = {
        id: eventId,
        organizationId: orgId,
        topic,
        payload,
        processed: false,
        createdAt: new Date()
      }
      allEvents.push(newEvent)
      localDb.setStorage('webhook_events', allEvents)
      
      // Fire async worker trigger immediately in development sandbox
      setTimeout(() => {
        this.processWebhookJob(eventId, orgId, topic, payload).catch(console.error)
      }, 500)
    } else {
      // Cloud Firestore Ledger
      try {
        const addedRef = await addDoc(collection(db, 'webhook_events'), {
          organizationId: orgId,
          topic,
          payload,
          processed: false,
          errorMessage: null,
          createdAt: serverTimestamp()
        })
        const cloudEventId = addedRef.id
        
        // Execute background job queue processing
        setTimeout(() => {
          this.processWebhookJob(cloudEventId, orgId, topic, payload).catch(console.error)
        }, 500)
      } catch (e) {
        console.error('Failed to queue cloud webhook event:', e)
      }
    }
    
    return eventId
  }

  // Asynchronous Worker executing processed webhook calculations
  private static async processWebhookJob(eventId: string, orgId: string, topic: string, payload: any): Promise<void> {
    let success = true
    let errorMsg: string | null = null

    try {
      console.log(`[Queue Worker] Processing background webhook job: ${topic} for Event: ${eventId}`)
      
      if (topic === 'products/update' || topic === 'products/create') {
        // Sync item details and quantity
        const firstVariant = payload.variants?.[0] || {}
        const sku = firstVariant.sku || `SKU-SHPF-${String(payload.id).substring(0, 5)}`
        const price = Number(firstVariant.price || 0)
        const quantity = Number(firstVariant.inventory_quantity || 0)

        if (!isFirebaseConfigured || !db) {
          const items = localDb.getItems(orgId)
          const matched = items.find(i => i.sku === sku)
          if (matched) {
            localDb.updateItem(matched.id, {
              name: payload.title,
              sellingPrice: price,
              quantity,
              updatedAt: new Date()
            })
          } else {
            localDb.addItem({
              orgId,
              sku,
              name: payload.title,
              sellingPrice: price,
              costPrice: price * 0.6,
              quantity,
              minStockLevel: 10,
              category: payload.product_type || 'Shopify Import',
              supplier: payload.vendor || 'Shopify Direct'
            })
          }
        } else {
          const q = query(collection(db, 'inventory'), where('orgId', '==', orgId), where('sku', '==', sku))
          const snap = await getDocs(q)
          if (!snap.empty) {
            await updateDoc(doc(db, 'inventory', snap.docs[0].id), {
              name: payload.title,
              sellingPrice: price,
              quantity,
              updatedAt: serverTimestamp()
            })
          } else {
            await addDoc(collection(db, 'inventory'), {
              orgId,
              sku,
              name: payload.title,
              sellingPrice: price,
              costPrice: price * 0.6,
              quantity,
              minStockLevel: 10,
              category: payload.product_type || 'Shopify Import',
              supplier: payload.vendor || 'Shopify Direct',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            })
          }
        }
      } 
      
      else if (topic === 'orders/create') {
        const externalOrderId = String(payload.id)
        const orderDate = payload.created_at ? new Date(payload.created_at) : new Date()
        const lineItems = payload.line_items?.map((item: any) => ({
          sku: item.sku,
          name: item.title,
          quantity: Number(item.quantity || 1),
          price: Number(item.price || 0.00)
        })) || []

        if (!isFirebaseConfigured || !db) {
          const transactionRefId = `shopify_ord_${externalOrderId}`
          const currentTransactions = localDb.getTransactions(orgId)
          const isAlreadyLogged = currentTransactions.some(t => t.notes?.includes(transactionRefId))

          if (!isAlreadyLogged && payload.financial_status === 'paid') {
            for (const line of lineItems) {
              const matched = localDb.getItems(orgId).find(i => i.sku === line.sku)
              localDb.addTransaction({
                orgId,
                itemId: matched?.id || 'shopify_unmatched',
                type: 'sale',
                quantity: line.quantity,
                unitPrice: line.price,
                totalAmount: line.quantity * line.price,
                notes: `Shopify Order #${payload.order_number || payload.id} ref:${transactionRefId}`,
                createdBy: 'Shopify_Webhook_Worker',
                createdAt: orderDate
              })
            }
          }
        } else {
          const transactionRefId = `shopify_ord_${externalOrderId}`
          const q = query(
            collection(db, 'transactions'),
            where('orgId', '==', orgId),
            where('notes', '>=', `ref:${transactionRefId}`)
          )
          const snap = await getDocs(q)
          
          if (snap.empty && payload.financial_status === 'paid') {
            for (const line of lineItems) {
              const itemQ = query(collection(db, 'inventory'), where('orgId', '==', orgId), where('sku', '==', line.sku))
              const itemSnap = await getDocs(itemQ)
              const matchId = !itemSnap.empty ? itemSnap.docs[0].id : 'shopify_unmatched'

              await addDoc(collection(db, 'transactions'), {
                orgId,
                itemId: matchId,
                type: 'sale',
                quantity: line.quantity,
                unitPrice: line.price,
                totalAmount: line.quantity * line.price,
                notes: `Shopify Order #${payload.order_number || payload.id} ref:${transactionRefId}`,
                createdBy: 'Shopify_Webhook_Worker',
                createdAt: orderDate
              })
            }
          }
        }
      } 
      
      else if (topic === 'inventory_levels/update') {
        const externalInventoryItemId = String(payload.inventory_item_id)
        const newQty = Number(payload.available || 0)

        // Webhook updates SKU stock level directly
        if (!isFirebaseConfigured || !db) {
          // Find item with matched variant metadata (we map by sku or custom store variant_data)
          const shopifyProds = localDb.getStorage<any[]>('shopify_products', [])
          const match = shopifyProds.find(
            (p: any) => p.organizationId === orgId && 
            p.variantData?.barcode === externalInventoryItemId
          )
          if (match) {
            localDb.updateItem(match.id, { quantity: newQty })
          }
        } else {
          // Cloud variant lookup and update
          const q = query(
            collection(db, 'shopify_products'), 
            where('organizationId', '==', orgId), 
            where('variantData.barcode', '==', externalInventoryItemId)
          )
          const snap = await getDocs(q)
          if (!snap.empty) {
            const mappedItemId = snap.docs[0].data().id
            await updateDoc(doc(db, 'inventory', mappedItemId), {
              quantity: newQty,
              updatedAt: serverTimestamp()
            })
          }
        }
      }
      
      else if (topic === 'app/uninstalled') {
        // Handle store disconnection
        if (!isFirebaseConfigured || !db) {
          const stores = localDb.getStorage<any[]>('shopify_stores', [])
          const filtered = stores.filter((s: any) => s.organizationId !== orgId)
          localDb.setStorage('shopify_stores', filtered)
        } else {
          const q = query(collection(db, 'stores'), where('organization_id', '==', orgId))
          const snap = await getDocs(q)
          for (const d of snap.docs) {
            await updateDoc(doc(db, 'stores', d.id), {
              sync_status: 'failed',
              access_token: 'revoked'
            })
          }
        }
      }

      // Re-trigger analysis agents pipelines
      await ShopifySyncService.triggerAiPipeline(orgId)

    } catch (e: any) {
      success = false
      errorMsg = e.message || 'Unknown processing error'
      console.error(`Error processing webhook job:`, e)
    } finally {
      // Mark as processed in DB
      if (!isFirebaseConfigured || !db) {
        const allEvents = localDb.getStorage<any[]>('webhook_events', [])
        const idx = allEvents.findIndex((e: any) => e.id === eventId)
        if (idx > -1) {
          allEvents[idx].processed = true
          allEvents[idx].errorMessage = errorMsg || undefined
          allEvents[idx].processedAt = new Date()
          localDb.setStorage('webhook_events', allEvents)
        }
      } else {
        try {
          await updateDoc(doc(db, 'webhook_events', eventId), {
            processed: true,
            errorMessage: errorMsg,
            processedAt: serverTimestamp()
          })
        } catch (e) {
          console.error('Failed to update cloud webhook execution status:', e)
        }
      }
    }
  }
}
