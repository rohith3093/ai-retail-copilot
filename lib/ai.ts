'use server'

import type { InventoryItem, AIInsight, Transaction } from './types'
import { orchestrateBusinessIntelligence } from './ai-agents'

export async function analyzeDeadStock(
  items: InventoryItem[],
  transactions: Transaction[],
  deadStockDays: number = 90
): Promise<AIInsight[]> {
  if (items.length === 0) return []
  
  const org = { 
    id: items[0]?.orgId || 'demo_org_123',
    name: 'Sharma Supermarket',
    slug: 'sharma-supermarket',
    ownerId: 'demo_owner_123',
    createdAt: new Date(),
    updatedAt: new Date(),
    settings: {
      currency: 'INR',
      taxRate: 18,
      lowStockThreshold: 15,
      deadStockDays: deadStockDays
    }
  }
  
  // Call master orchestrator which compiles all agent analyses
  const insights = await orchestrateBusinessIntelligence(items, transactions, org)
  
  // Return the dead stock specific insights for this view
  return insights.filter((insight) => insight.type === 'dead_stock')
}

export async function generateInventoryInsights(
  items: InventoryItem[],
  transactions: Transaction[]
): Promise<AIInsight[]> {
  if (items.length === 0) return []

  const org = { 
    id: items[0]?.orgId || 'demo_org_123',
    name: 'Sharma Supermarket',
    slug: 'sharma-supermarket',
    ownerId: 'demo_owner_123',
    createdAt: new Date(),
    updatedAt: new Date(),
    settings: {
      currency: 'INR',
      taxRate: 18,
      lowStockThreshold: 15,
      deadStockDays: 45
    }
  }

  return await orchestrateBusinessIntelligence(items, transactions, org)
}
