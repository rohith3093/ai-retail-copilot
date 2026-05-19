export class MockShopifyProvider {
  
  // Return a set of mock Shopify products for developer sandbox testing
  public static getMockShopifyProducts(): any[] {
    return [
      {
        id: 88771122,
        title: 'Premium Wireless Headphones',
        vendor: 'Soundwave Inc.',
        product_type: 'Electronics',
        variants: [
          {
            id: 99112233,
            sku: 'SKU-HEAD-WIRE',
            price: 7999.00,
            cost_price: 4500.00,
            inventory_quantity: 48,
            barcode: '123456789012'
          }
        ]
      },
      {
        id: 88771123,
        title: 'Organic Green Tea (50 bags)',
        vendor: 'Nature Leaf',
        product_type: 'Food & Beverages',
        variants: [
          {
            id: 99112234,
            sku: 'SKU-TEA-GREEN',
            price: 450.00,
            cost_price: 220.00,
            inventory_quantity: 120,
            barcode: '123456789013'
          }
        ]
      },
      {
        id: 88771124,
        title: 'Ergonomic Desk Chair',
        vendor: 'Comfort Works',
        product_type: 'Home & Garden',
        variants: [
          {
            id: 99112235,
            sku: 'SKU-CHAIR-ERGO',
            price: 14999.00,
            cost_price: 8500.00,
            inventory_quantity: 3, // Low stock indicator
            barcode: '123456789014'
          }
        ]
      },
      {
        id: 88771125,
        title: 'Stainless Steel Water Bottle (1L)',
        vendor: 'HydroFlasker',
        product_type: 'Sports & Outdoors',
        variants: [
          {
            id: 99112236,
            sku: 'SKU-BOTTLE-STEEL',
            price: 1800.00,
            cost_price: 950.00,
            inventory_quantity: 65,
            barcode: '123456789015'
          }
        ]
      },
      {
        id: 88771126,
        title: 'Anti-Aging Hyaluronic Serum',
        vendor: 'Glow Derma',
        product_type: 'Health & Beauty',
        variants: [
          {
            id: 99112237,
            sku: 'SKU-SERUM-HYAL',
            price: 2450.00,
            cost_price: 1100.00,
            inventory_quantity: 2, // Low stock trigger
            barcode: '123456789016'
          }
        ]
      }
    ]
  }

  // Return a set of mock orders
  public static getMockShopifyOrders(): any[] {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    return [
      {
        id: 554433221,
        order_number: 1001,
        total_price: 8449.00,
        created_at: new Date().toISOString(),
        financial_status: 'paid',
        customer: {
          id: 44332211,
          first_name: 'Aditya',
          last_name: 'Sen'
        },
        line_items: [
          {
            sku: 'SKU-HEAD-WIRE',
            title: 'Premium Wireless Headphones',
            quantity: 1,
            price: 7999.00
          },
          {
            sku: 'SKU-TEA-GREEN',
            title: 'Organic Green Tea (50 bags)',
            quantity: 1,
            price: 450.00
          }
        ]
      },
      {
        id: 554433222,
        order_number: 1002,
        total_price: 3600.00,
        created_at: yesterday.toISOString(),
        financial_status: 'paid',
        customer: {
          id: 44332212,
          first_name: 'Priyanka',
          last_name: 'Sharma'
        },
        line_items: [
          {
            sku: 'SKU-BOTTLE-STEEL',
            title: 'Stainless Steel Water Bottle (1L)',
            quantity: 2,
            price: 1800.00
          }
        ]
      },
      {
        id: 554433223,
        order_number: 1003,
        total_price: 14999.00,
        created_at: twoDaysAgo.toISOString(),
        financial_status: 'paid',
        customer: {
          id: 44332213,
          first_name: 'Vikram',
          last_name: 'Rao'
        },
        line_items: [
          {
            sku: 'SKU-CHAIR-ERGO',
            title: 'Ergonomic Desk Chair',
            quantity: 1,
            price: 14999.00
          }
        ]
      }
    ]
  }

  // Return mock Shopify customers
  public static getMockShopifyCustomers(): any[] {
    return [
      {
        id: 44332211,
        first_name: 'Aditya',
        last_name: 'Sen',
        email: 'aditya.sen@gmail.com',
        orders_count: 3,
        total_spent: 12500.00
      },
      {
        id: 44332212,
        first_name: 'Priyanka',
        last_name: 'Sharma',
        email: 'priyanka.sh@outlook.com',
        orders_count: 5,
        total_spent: 18450.00
      },
      {
        id: 44332213,
        first_name: 'Vikram',
        last_name: 'Rao',
        email: 'vikram.rao@yahoo.com',
        orders_count: 1,
        total_spent: 14999.00
      },
      {
        id: 44332214,
        first_name: 'Nisha',
        last_name: 'Patel',
        email: 'nisha.patel@gmail.com',
        orders_count: 0,
        total_spent: 0.00
      }
    ]
  }

  // Generate payload for mock webhook simulator testing
  public static generateMockWebhookPayload(topic: string, details?: any): any {
    const timestamp = new Date().toISOString()
    const mockId = Math.floor(Math.random() * 90000000) + 10000000

    switch (topic) {
      case 'products/update':
      case 'products/create':
        return {
          id: mockId,
          title: details?.title || 'Simulated Cool T-Shirt',
          vendor: details?.vendor || 'Apparel Shop',
          product_type: details?.category || 'Apparel',
          created_at: timestamp,
          updated_at: timestamp,
          variants: [
            {
              id: mockId + 1000,
              sku: details?.sku || `SKU-SIM-${mockId}`,
              price: details?.price || 1200.00,
              inventory_quantity: details?.quantity || 15,
              barcode: details?.barcode || '987654321098'
            }
          ]
        }

      case 'orders/create':
        return {
          id: mockId,
          order_number: Math.floor(Math.random() * 9000) + 1000,
          total_price: details?.totalPrice || 2400.00,
          financial_status: details?.financialStatus || 'paid',
          created_at: timestamp,
          customer: {
            id: 44332211,
            first_name: details?.customerName?.split(' ')?.[0] || 'Rahul',
            last_name: details?.customerName?.split(' ')?.[1] || 'Verma',
            email: details?.customerEmail || 'rahul.verma@example.com'
          },
          line_items: details?.lineItems || [
            {
              sku: details?.sku || 'SKU-HEAD-WIRE',
              title: details?.name || 'Premium Wireless Headphones',
              quantity: details?.quantity || 1,
              price: details?.price || 2400.00
            }
          ]
        }

      case 'inventory_levels/update':
        return {
          inventory_item_id: details?.barcode || '123456789012', // Linked to product.variantData.barcode
          available: details?.quantity || 22,
          updated_at: timestamp
        }

      case 'app/uninstalled':
        return {
          id: mockId,
          uninstall_reason: 'User request'
        }

      default:
        return {
          id: mockId,
          timestamp
        }
    }
  }
}
