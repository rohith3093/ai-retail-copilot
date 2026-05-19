import { NextRequest, NextResponse } from 'next/server'
import { ShopifyAuthService } from '../../../../services/shopify/auth.service'
import { ShopifyWebhooksService } from '../../../../services/shopify/webhooks.service'
import { localDb } from '../../../../lib/localDb'
import { db, isFirebaseConfigured } from '../../../../lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export async function POST(request: NextRequest) {
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256') || ''
  const topic = request.headers.get('x-shopify-topic') || ''
  const shopDomain = request.headers.get('x-shopify-shop-domain') || ''

  try {
    const rawBody = await request.text()
    
    // Validate HMAC signature (Optional in local development without keys)
    const isLocalDev = process.env.NODE_ENV === 'development' || !process.env.SHOPIFY_CLIENT_SECRET
    const isValidSignature = isLocalDev || ShopifyAuthService.verifyWebhookHmac(rawBody, hmacHeader)
    
    if (!isValidSignature) {
      console.warn('Shopify webhook signature check failed')
      return NextResponse.json({ error: 'HMAC signature verification failed' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody)

    // Lookup active store metadata mapping to obtain corresponding organization_id
    let orgId = ''
    if (!isFirebaseConfigured || !db) {
      const stores = localDb.getStorage<any[]>('shopify_stores', [])
      const matched = stores.find(s => s.shopDomain.toLowerCase() === shopDomain.toLowerCase())
      orgId = matched?.organizationId || 'demo_org_123'
    } else {
      const q = query(collection(db, 'stores'), where('shop_domain', '==', shopDomain))
      const snap = await getDocs(q)
      if (!snap.empty) {
        orgId = snap.docs[0].data().organization_id
      } else {
        orgId = 'demo_org_123' // default fallback
      }
    }

    // Queue webhook event processing asynchronously (Instantly yields thread to avoid timeout)
    const queuedEventId = await ShopifyWebhooksService.queueWebhook(orgId, topic, payload)
    
    console.log(`[Webhook Ingestion] Successfully queued webhook event ${queuedEventId} for topic: ${topic}`)
    return NextResponse.json({ success: true, eventId: queuedEventId }, { status: 200 })

  } catch (error: any) {
    console.error('Failed shopify webhook handler execution:', error)
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 })
  }
}
