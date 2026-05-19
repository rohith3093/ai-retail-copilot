import crypto from 'crypto'

export class ShopifyAuthService {
  private static ENCRYPTION_KEY = process.env.SHOPIFY_ENCRYPTION_KEY || 'default_32_byte_secret_key_for_retail_copilot_development'
  private static CLIENT_ID = process.env.SHOPIFY_CLIENT_ID || 'mock_shopify_client_id_123'
  private static CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET || 'mock_shopify_client_secret_456'

  // Generate OAuth URL
  public static getAuthUrl(shopDomain: string, redirectUri: string, state: string): string {
    const scopes = ['read_products', 'read_inventory', 'read_orders', 'read_customers'].join(',')
    const sanitizedShop = shopDomain.replace(/^https?:\/\//, '').trim()
    return `https://${sanitizedShop}/admin/oauth/authorize?client_id=${this.CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
  }

  // Verify HMAC header from webhook requests
  public static verifyWebhookHmac(rawBody: string, hmacHeader: string): boolean {
    if (!hmacHeader) return false
    const hash = crypto
      .createHmac('sha256', this.CLIENT_SECRET)
      .update(rawBody, 'utf8')
      .digest('base64')
    return hash === hmacHeader
  }

  // Exchange auth authorization code for persistent access token
  public static async exchangeCodeForToken(shopDomain: string, code: string): Promise<string> {
    const sanitizedShop = shopDomain.replace(/^https?:\/\//, '').trim()
    
    // In Mock Mode, return dummy token
    if (code === 'mock_auth_code_123' || this.CLIENT_ID === 'mock_shopify_client_id_123') {
      return 'shpat_mock_token_abc123'
    }

    try {
      const response = await fetch(`https://${sanitizedShop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.CLIENT_ID,
          client_secret: this.CLIENT_SECRET,
          code,
        }),
      })

      if (!response.ok) {
        throw new Error(`Shopify Token Exchange returned status ${response.status}`)
      }

      const data = await response.json()
      return data.access_token
    } catch (error) {
      console.error('Error exchanging Shopify code for token:', error)
      throw error
    }
  }

  // AES-256 Token Encryption at Rest
  public static encryptToken(token: string): string {
    try {
      const iv = crypto.randomBytes(16)
      const cipher = crypto.createCipheriv(
        'aes-256-cbc', 
        Buffer.from(this.ENCRYPTION_KEY.padEnd(32).substring(0, 32)), 
        iv
      )
      let encrypted = cipher.update(token, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      return `${iv.toString('hex')}:${encrypted}`
    } catch (e) {
      console.error('Failed token encryption, returning plain:', e)
      return token
    }
  }

  // AES-256 Token Decryption
  public static decryptToken(encryptedValue: string): string {
    if (!encryptedValue.includes(':')) return encryptedValue
    try {
      const [ivHex, encrypted] = encryptedValue.split(':')
      const iv = Buffer.from(ivHex, 'hex')
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc', 
        Buffer.from(this.ENCRYPTION_KEY.padEnd(32).substring(0, 32)), 
        iv
      )
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch (e) {
      console.error('Failed token decryption, returning raw value:', e)
      return encryptedValue
    }
  }
}
