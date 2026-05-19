import type { ShopifyProduct, ShopifyOrder, ShopifyCustomer } from '../types'

export interface IConnector {
  name: string
  
  // Connection auth methods
  getAuthUrl(shopDomain: string, redirectUri: string, state: string): string
  exchangeCodeForToken(shopDomain: string, code: string): Promise<string>
  
  // Sync methods
  syncProducts(orgId: string, storeId: string, accessToken: string, shopDomain: string): Promise<ShopifyProduct[]>
  syncOrders(orgId: string, storeId: string, accessToken: string, shopDomain: string, sinceDate?: Date): Promise<ShopifyOrder[]>
  syncCustomers(orgId: string, storeId: string, accessToken: string, shopDomain: string): Promise<ShopifyCustomer[]>
  
  // Webhooks
  registerWebhooks(shopDomain: string, accessToken: string, webhookUrl: string): Promise<boolean>
  verifyWebhookHmac(rawBody: string, hmacHeader: string): boolean
}
