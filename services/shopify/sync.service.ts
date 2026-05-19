import type { ShopifyProduct, ShopifyOrder, ShopifyCustomer, InventoryItem, Transaction } from '../../lib/types'
import { localDb } from '../../lib/localDb'
import { db, isFirebaseConfigured } from '../../lib/firebase'
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'

export class ShopifySyncService {
  
  // Sync Products Incremental
  public static async syncProducts(
    orgId: string, 
    storeId: string, 
    accessToken: string, 
    shopDomain: string
  ): Promise<ShopifyProduct[]> {
    const isMock = accessToken.startsWith('shpat_mock_') || !shopDomain
    
    // In real mode, we would call the Shopify REST endpoint:
    // GET /admin/api/2024-04/products.json
    let rawProducts: any[] = []
    
    if (isMock) {
      // Mock generation fallback
      const mockProvider = await import('./mock.provider')
      rawProducts = mockProvider.MockShopifyProvider.getMockShopifyProducts()
    } else {
      try {
        const response = await fetch(`https://${shopDomain}/admin/api/2024-04/products.json`, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          }
        })
        if (response.ok) {
          const data = await response.json()
          rawProducts = data.products || []
        }
      } catch (err) {
        console.error('Failed to fetch real shopify products, using mock fallback:', err)
        const mockProvider = await import('./mock.provider')
        rawProducts = mockProvider.MockShopifyProvider.getMockShopifyProducts()
      }
    }

    const syncedProducts: ShopifyProduct[] = []

    for (const raw of rawProducts) {
      const externalId = String(raw.id)
      const firstVariant = raw.variants?.[0] || {}
      
      const productData: Omit<ShopifyProduct, 'id'> = {
        organizationId: orgId,
        storeId,
        externalProductId: externalId,
        title: raw.title,
        sku: firstVariant.sku || `SKU-SHPF-${externalId.substring(0, 5)}`,
        category: raw.product_type || 'Shopify Import',
        vendor: raw.vendor || 'Shopify Vendor',
        price: Number(firstVariant.price || 0.00),
        cost: Number(firstVariant.cost_price || (firstVariant.price ? firstVariant.price * 0.6 : 0)), // Mock cost if empty
        inventoryQuantity: Number(firstVariant.inventory_quantity || 0),
        variantData: {
          variantsCount: raw.variants?.length || 1,
          images: raw.images?.map((im: any) => im.src) || [],
          barcode: firstVariant.barcode || ''
        },
        lastSyncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Write to Database (Firebase/Supabase or localDb)
      if (!isFirebaseConfigured || !db) {
        // LocalDb check
        const existingItems = localDb.getItems(orgId)
        const matched = existingItems.find(i => i.sku === productData.sku)
        
        let itemId = ''
        if (matched) {
          itemId = matched.id
          localDb.updateItem(matched.id, {
            name: productData.title,
            category: productData.category || 'Shopify Import',
            sellingPrice: productData.price,
            costPrice: productData.cost || 0,
            quantity: productData.inventoryQuantity,
            updatedAt: new Date()
          })
        } else {
          const added = localDb.addItem({
            orgId,
            sku: productData.sku || '',
            name: productData.title,
            category: productData.category || 'Shopify Import',
            sellingPrice: productData.price,
            costPrice: productData.cost || 0,
            quantity: productData.inventoryQuantity,
            minStockLevel: 10,
            supplier: productData.vendor || 'Shopify Direct',
          })
          itemId = added.id
        }

        // Store integration link in local storage stores
        const storesProducts = localDb.getStorage<any[]>('shopify_products', [])
        const cleanStoresProducts = storesProducts.filter((p: any) => !(p.organizationId === orgId && p.externalProductId === externalId))
        const newProduct = {
          id: itemId,
          ...productData,
        } as ShopifyProduct
        cleanStoresProducts.push(newProduct)
        localDb.setStorage('shopify_products', cleanStoresProducts)
        syncedProducts.push(newProduct)
      } else {
        // Cloud Firestore Mode
        try {
          const q = query(
            collection(db, 'inventory'), 
            where('orgId', '==', orgId), 
            where('sku', '==', productData.sku)
          )
          const snapshot = await getDocs(q)
          let itemId = ''
          
          if (!snapshot.empty) {
            const docId = snapshot.docs[0].id
            itemId = docId
            await updateDoc(doc(db, 'inventory', docId), {
              name: productData.title,
              category: productData.category || 'Shopify Import',
              sellingPrice: productData.price,
              costPrice: productData.cost || 0,
              quantity: productData.inventoryQuantity,
              updatedAt: serverTimestamp()
            })
          } else {
            const addedRef = await addDoc(collection(db, 'inventory'), {
              orgId,
              sku: productData.sku || '',
              name: productData.title,
              category: productData.category || 'Shopify Import',
              sellingPrice: productData.price,
              costPrice: productData.cost || 0,
              quantity: productData.inventoryQuantity,
              minStockLevel: 10,
              supplier: productData.vendor || 'Shopify Direct',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            })
            itemId = addedRef.id
          }

          // Register in shopify_products bridge table
          const bridgeId = `${orgId}_${externalId}`
          const bridgeRef = doc(db, 'shopify_products', bridgeId)
          const newProduct = {
            id: itemId,
            ...productData,
            createdAt: new Date(),
            updatedAt: new Date()
          } as ShopifyProduct
          await setDoc(bridgeRef, {
            ...newProduct,
            lastSyncedAt: serverTimestamp()
          })
          syncedProducts.push(newProduct)
        } catch (e) {
          console.error('Firebase Product sync error:', e)
        }
      }
    }

    return syncedProducts;
  }

  // Sync Orders Incremental
  public static async syncOrders(
    orgId: string, 
    storeId: string, 
    accessToken: string, 
    shopDomain: string
  ): Promise<ShopifyOrder[]> {
    const isMock = accessToken.startsWith('shpat_mock_') || !shopDomain
    let rawOrders: any[] = []

    if (isMock) {
      const mockProvider = await import('./mock.provider')
      rawOrders = mockProvider.MockShopifyProvider.getMockShopifyOrders()
    } else {
      try {
        const response = await fetch(`https://${shopDomain}/admin/api/2024-04/orders.json?status=any`, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          }
        })
        if (response.ok) {
          const data = await response.json()
          rawOrders = data.orders || []
        }
      } catch (err) {
        console.error('Failed to fetch real Shopify orders, using mock:', err)
        const mockProvider = await import('./mock.provider')
        rawOrders = mockProvider.MockShopifyProvider.getMockShopifyOrders()
      }
    }

    const syncedOrders: ShopifyOrder[] = []

    for (const raw of rawOrders) {
      const externalOrderId = String(raw.id)
      const orderDate = raw.created_at ? new Date(raw.created_at) : new Date()
      
      const orderData: Omit<ShopifyOrder, 'id'> = {
        organizationId: orgId,
        storeId,
        externalOrderId,
        totalPrice: Number(raw.total_price || 0.00),
        externalCustomerId: raw.customer ? String(raw.customer.id) : undefined,
        orderDate,
        lineItems: raw.line_items?.map((item: any) => ({
          sku: item.sku,
          name: item.title,
          quantity: Number(item.quantity || 1),
          price: Number(item.price || 0.00)
        })) || [],
        financialStatus: raw.financial_status || 'paid',
        lastSyncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      if (!isFirebaseConfigured || !db) {
        // localDb Mode
        const storesOrders = localDb.getStorage<any[]>('shopify_orders', [])
        const cleanStoresOrders = storesOrders.filter((o: any) => !(o.organizationId === orgId && o.externalOrderId === externalOrderId))
        
        // Log transaction details to counter sales ledger
        const transactionRefId = `shopify_ord_${externalOrderId}`
        const currentTransactions = localDb.getTransactions(orgId)
        const isAlreadyLogged = currentTransactions.some(t => t.notes?.includes(transactionRefId))

        if (!isAlreadyLogged && orderData.financialStatus === 'paid') {
          // Log each line item as a sale
          for (const line of orderData.lineItems) {
            const matchingItem = localDb.getItems(orgId).find(i => i.sku === line.sku)
            localDb.addTransaction({
              orgId,
              itemId: matchingItem?.id || 'shopify_unmatched',
              type: 'sale',
              quantity: line.quantity,
              unitPrice: line.price,
              totalAmount: line.quantity * line.price,
              notes: `Shopify Order #${raw.order_number || raw.id} ref:${transactionRefId}`,
              createdBy: 'Shopify_Sync_Agent',
              createdAt: orderDate
            })
          }
        }

        const newOrder = {
          id: `order_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...orderData,
        } as ShopifyOrder
        cleanStoresOrders.push(newOrder)
        localDb.setStorage('shopify_orders', cleanStoresOrders)
        syncedOrders.push(newOrder)
      } else {
        // Cloud Firestore Mode
        try {
          const bridgeId = `${orgId}_${externalOrderId}`
          const bridgeRef = doc(db, 'shopify_orders', bridgeId)
          
          const newOrder = {
            id: bridgeId,
            ...orderData,
            createdAt: new Date(),
            updatedAt: new Date()
          } as ShopifyOrder

          await setDoc(bridgeRef, {
            ...newOrder,
            lastSyncedAt: serverTimestamp()
          })

          // Double check transaction logs
          const q = query(
            collection(db, 'transactions'),
            where('orgId', '==', orgId),
            where('notes', '>=', `ref:shopify_ord_${externalOrderId}`)
          )
          const snapshot = await getDocs(q)
          
          if (snapshot.empty && orderData.financialStatus === 'paid') {
            for (const line of orderData.lineItems) {
              const itemQ = query(collection(db, 'inventory'), where('orgId', '==', orgId), where('sku', '==', line.sku))
              const itemSnapshot = await getDocs(itemQ)
              const matchId = !itemSnapshot.empty ? itemSnapshot.docs[0].id : 'shopify_unmatched'

              await addDoc(collection(db, 'transactions'), {
                orgId,
                itemId: matchId,
                type: 'sale',
                quantity: line.quantity,
                unitPrice: line.price,
                totalAmount: line.quantity * line.price,
                notes: `Shopify Order #${raw.order_number || raw.id} ref:shopify_ord_${externalOrderId}`,
                createdBy: 'Shopify_Sync_Agent',
                createdAt: orderDate
              })
            }
          }
          syncedOrders.push(newOrder)
        } catch (e) {
          console.error('Firebase Order sync error:', e)
        }
      }
    }

    return syncedOrders
  }

  // Sync Customers Incremental
  public static async syncCustomers(
    orgId: string, 
    storeId: string, 
    accessToken: string, 
    shopDomain: string
  ): Promise<ShopifyCustomer[]> {
    const isMock = accessToken.startsWith('shpat_mock_') || !shopDomain
    let rawCustomers: any[] = []

    if (isMock) {
      const mockProvider = await import('./mock.provider')
      rawCustomers = mockProvider.MockShopifyProvider.getMockShopifyCustomers()
    } else {
      try {
        const response = await fetch(`https://${shopDomain}/admin/api/2024-04/customers.json`, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          }
        })
        if (response.ok) {
          const data = await response.json()
          rawCustomers = data.customers || []
        }
      } catch (err) {
        console.error('Failed to fetch real Shopify customers, using mock:', err)
        const mockProvider = await import('./mock.provider')
        rawCustomers = mockProvider.MockShopifyProvider.getMockShopifyCustomers()
      }
    }

    const syncedCustomers: ShopifyCustomer[] = []

    for (const raw of rawCustomers) {
      const externalCustomerId = String(raw.id)
      const customerData: Omit<ShopifyCustomer, 'id'> = {
        organizationId: orgId,
        storeId,
        externalCustomerId,
        name: `${raw.first_name || ''} ${raw.last_name || ''}`.trim() || 'Valued Customer',
        email: raw.email || undefined,
        orderCount: Number(raw.orders_count || 0),
        totalSpent: Number(raw.total_spent || 0.00),
        lastSyncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      if (!isFirebaseConfigured || !db) {
        // localDb Mode
        const storesCustomers = localDb.getStorage<any[]>('shopify_customers', [])
        const cleanStoresCustomers = storesCustomers.filter((c: any) => !(c.organizationId === orgId && c.externalCustomerId === externalCustomerId))
        const newCustomer = {
          id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...customerData,
        } as ShopifyCustomer
        cleanStoresCustomers.push(newCustomer)
        localDb.setStorage('shopify_customers', cleanStoresCustomers)
        syncedCustomers.push(newCustomer)
      } else {
        // Cloud Firestore Mode
        try {
          const bridgeId = `${orgId}_${externalCustomerId}`
          const bridgeRef = doc(db, 'shopify_customers', bridgeId)
          const newCustomer = {
            id: bridgeId,
            ...customerData,
            createdAt: new Date(),
            updatedAt: new Date()
          } as ShopifyCustomer

          await setDoc(bridgeRef, {
            ...newCustomer,
            lastSyncedAt: serverTimestamp()
          })
          syncedCustomers.push(newCustomer)
        } catch (e) {
          console.error('Firebase Customer sync error:', e)
        }
      }
    }

    return syncedCustomers
  }

  // Trigger Master Intelligence Agent orchestrator calculations
  public static async triggerAiPipeline(orgId: string): Promise<void> {
    try {
      const currentOrgObj = !isFirebaseConfigured || !db
        ? localDb.getOrgs().find(o => o.id === orgId)
        : null // Handled dynamically in AI orchestrator

      if (!isFirebaseConfigured || !db) {
        const items = localDb.getItems(orgId)
        const transactions = localDb.getTransactions(orgId)
        if (items.length > 0 && currentOrgObj) {
          const { orchestrateBusinessIntelligence } = await import('../../lib/ai-agents')
          await orchestrateBusinessIntelligence(items, transactions, currentOrgObj as any)
        }
      } else {
        // Firebase pipeline triggers via fetching and sending active snapshot context
        const itemsColl = collection(db, 'inventory')
        const txColl = collection(db, 'transactions')
        const orgsColl = collection(db, 'organizations')

        const itemsSnap = await getDocs(query(itemsColl, where('orgId', '==', orgId)))
        const txSnap = await getDocs(query(txColl, where('orgId', '==', orgId)))
        const orgSnap = await getDocs(query(orgsColl, where('id', '==', orgId)))

        const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as InventoryItem[]
        const transactions = txSnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() })) as Transaction[]
        const org = orgSnap.empty ? null : orgSnap.docs[0].data()

        if (items.length > 0 && org) {
          const { orchestrateBusinessIntelligence } = await import('../../lib/ai-agents')
          await orchestrateBusinessIntelligence(items, transactions, org as any)
        }
      }
    } catch (err) {
      console.error('Error triggering shopify integration AI analysis:', err)
    }
  }
}
