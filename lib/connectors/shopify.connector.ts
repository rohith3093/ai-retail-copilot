import { IConnector } from './connector.interface'
import { ShopifyAuthService } from '../../services/shopify/auth.service'
import { ShopifySyncService } from '../../services/shopify/sync.service'
import { ShopifyWebhooksService } from '../../services/shopify/webhooks.service'
import type { ShopifyProduct, ShopifyOrder, ShopifyCustomer } from '../types'

export class ShopifyConnector implements IConnector {
  public name = 'shopify'

  public getAuthUrl(shopDomain: string, redirectUri: string, state: string): string {
    return ShopifyAuthService.getAuthUrl(shopDomain, redirectUri, state)
  }

  public async exchangeCodeForToken(shopDomain: string, code: string): Promise<string> {
    return ShopifyAuthService.exchangeCodeForToken(shopDomain, code)
  }

  public async syncProducts(
    orgId: string, 
    storeId: string, 
    accessToken: string, 
    shopDomain: string
  ): Promise<ShopifyProduct[]> {
    return ShopifySyncService.syncProducts(orgId, storeId, accessToken, shopDomain)
  }

  public async syncOrders(
    orgId: string, 
    storeId: string, 
    accessToken: string, 
    shopDomain: string, 
    sinceDate?: Date
  ): Promise<ShopifyOrder[]> {
    return ShopifySyncService.syncOrders(orgId, storeId, accessToken, shopDomain)
  }

  public async syncCustomers(
    orgId: string, 
    storeId: string, 
    accessToken: string, 
    shopDomain: string
  ): Promise<ShopifyCustomer[]> {
    return ShopifySyncService.syncCustomers(orgId, storeId, accessToken, shopDomain)
  }

  public async registerWebhooks(shopDomain: string, accessToken: string, webhookUrl: string): Promise<boolean> {
    return ShopifyWebhooksService.registerWebhooks(shopDomain, accessToken, webhookUrl)
  }

  public verifyWebhookHmac(rawBody: string, hmacHeader: string): boolean {
    return ShopifyAuthService.verifyWebhookHmac(rawBody, hmacHeader)
  }
}
