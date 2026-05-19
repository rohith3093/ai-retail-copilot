import { NextRequest, NextResponse } from 'next/server'
import { ShopifyAuthService } from '../../../../services/shopify/auth.service'
import { ShopifySyncService } from '../../../../services/shopify/sync.service'
import { ShopifyWebhooksService } from '../../../../services/shopify/webhooks.service'
import { localDb } from '../../../../lib/localDb'
import { db, isFirebaseConfigured } from '../../../../lib/firebase'
import { collection, addDoc, updateDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const shop = searchParams.get('shop')
  const state = searchParams.get('state')

  const cookieState = request.cookies.get('shopify_oauth_state')?.value

  if (!code || !shop || !state) {
    return NextResponse.json({ error: 'Missing code, shop, or state parameters' }, { status: 400 })
  }

  // Validate CSRF state
  if (state !== cookieState) {
    return NextResponse.json({ error: 'CSRF state verification failed' }, { status: 403 })
  }

  // Extract orgId from state string
  const orgMatch = state.match(/^org_([^_]+)_/)
  const orgId = orgMatch ? orgMatch[1] : null

  if (!orgId) {
    return NextResponse.json({ error: 'Invalid state parameter structure' }, { status: 400 })
  }

  try {
    const shopDomain = shop.replace(/^https?:\/\//, '').trim()

    // 1. Exchange auth code for access token
    const accessToken = await ShopifyAuthService.exchangeCodeForToken(shopDomain, code)

    // 2. Encrypt token at rest
    const encryptedToken = ShopifyAuthService.encryptToken(accessToken)

    let storeId = `store_${Date.now()}`

    // 3. Persist the store settings to DB
    if (!isFirebaseConfigured || !db) {
      const allStores = localDb.getStorage<any[]>('shopify_stores', [])
      const cleanStores = allStores.filter(s => s.organizationId !== orgId)
      
      const newStore = {
        id: storeId,
        organizationId: orgId,
        shopDomain,
        accessToken: encryptedToken,
        connectedAt: new Date(),
        syncStatus: 'syncing',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      cleanStores.push(newStore)
      localDb.setStorage('shopify_stores', cleanStores)
    } else {
      // Cloud store mapping
      const bridgeId = `${orgId}_shopify`
      storeId = bridgeId
      const storeRef = doc(db, 'stores', bridgeId)
      await setDoc(storeRef, {
        id: bridgeId,
        organization_id: orgId,
        shop_domain: shopDomain,
        access_token: encryptedToken,
        connected_at: serverTimestamp(),
        sync_status: 'syncing',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      })
    }

    // 4. Fire Background Sync incremental operations and webhooks registration
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = request.nextUrl.protocol
    const webhookBaseUrl = `${protocol}//${host}`

    // Run async sync onboarding process in the background
    setTimeout(async () => {
      try {
        console.log(`[Onboarding sync] Beginning initial Shopify import for store: ${shopDomain}`)
        
        // Webhooks registration
        await ShopifyWebhooksService.registerWebhooks(shopDomain, accessToken, webhookBaseUrl)
        
        // Fetch products, orders, customers
        await ShopifySyncService.syncProducts(orgId, storeId, accessToken, shopDomain)
        await ShopifySyncService.syncOrders(orgId, storeId, accessToken, shopDomain)
        await ShopifySyncService.syncCustomers(orgId, storeId, accessToken, shopDomain)

        // Mark sync status as successful
        if (!isFirebaseConfigured || !db) {
          const stores = localDb.getStorage<any[]>('shopify_stores', [])
          const idx = stores.findIndex(s => s.id === storeId)
          if (idx > -1) {
            stores[idx].syncStatus = 'success'
            stores[idx].lastSyncedAt = new Date()
            localDb.setStorage('shopify_stores', stores)
          }
        } else {
          await updateDoc(doc(db, 'stores', storeId), {
            sync_status: 'success',
            last_synced_at: serverTimestamp()
          })
        }

        // Trigger AI analysis loop
        await ShopifySyncService.triggerAiPipeline(orgId)

      } catch (err) {
        console.error('Failed initial store onboarding synchronization:', err)
        if (!isFirebaseConfigured || !db) {
          const stores = localDb.getStorage<any[]>('shopify_stores', [])
          const idx = stores.findIndex(s => s.id === storeId)
          if (idx > -1) {
            stores[idx].syncStatus = 'failed'
            localDb.setStorage('shopify_stores', stores)
          }
        } else {
          await updateDoc(doc(db, 'stores', storeId), {
            sync_status: 'failed'
          }).catch(console.error)
        }
      }
    }, 500)

    // 5. Redirect user back to Shopify Sync settings dashboard
    const hostUrl = `${protocol}//${host}/dashboard/shopify?success=true`
    const redirectResponse = NextResponse.redirect(hostUrl)
    redirectResponse.cookies.delete('shopify_oauth_state')
    return redirectResponse

  } catch (error) {
    console.error('Error handling Shopify Auth Callback:', error)
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = request.nextUrl.protocol
    return NextResponse.redirect(`${protocol}//${host}/dashboard/shopify?error=auth_failed`)
  }
}
