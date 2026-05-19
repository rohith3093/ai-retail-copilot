import { NextRequest, NextResponse } from 'next/server'
import { ShopifyAuthService } from '../../../../services/shopify/auth.service'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const shop = searchParams.get('shop')
  const orgId = searchParams.get('orgId')

  if (!shop) {
    return NextResponse.json({ error: 'Missing shop domain parameter' }, { status: 400 })
  }
  if (!orgId) {
    return NextResponse.json({ error: 'Missing orgId parameter' }, { status: 400 })
  }

  // Sanitize shop domain
  const shopDomain = shop.replace(/^https?:\/\//, '').trim()

  // Generate unique CSRF state containing the orgId
  const state = `org_${orgId}_state_${Date.now()}`

  // Retrieve base redirect callback URI
  const host = request.headers.get('host') || 'localhost:3000'
  const protocol = request.nextUrl.protocol
  const redirectUri = `${protocol}//${host}/api/shopify/callback`

  const authorizationUrl = ShopifyAuthService.getAuthUrl(shopDomain, redirectUri, state)

  const response = NextResponse.redirect(authorizationUrl)

  // Save state cookie for CSRF state validation on callback landing
  response.cookies.set('shopify_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 3600, // 1 hour expiry
    path: '/'
  })

  return response
}
