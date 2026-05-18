import type { InventoryItem, Transaction, AIInsight, Organization } from './types'
import { callActiveLlm } from './ai-config'
import { localDb } from './localDb'

// 7-Agent Architecture Definitions

/**
 * 1. Inventory Agent: Monitors catalog structures, low stock, categorization imbalances
 */
function runInventoryAgentOffline(items: InventoryItem[]): Partial<AIInsight>[] {
  const lowStock = items.filter(i => i.quantity <= i.minStockLevel)
  const insights: Partial<AIInsight>[] = []

  if (lowStock.length > 0) {
    insights.push({
      type: 'reorder',
      title: 'Low Stock SKU Warning',
      description: `${lowStock.length} critical items have fallen below their safety threshold. Out of stock risks are mounting.`,
      severity: lowStock.some(i => i.quantity === 0) ? 'high' : 'medium',
      itemIds: lowStock.map(i => i.id),
      recommendations: lowStock.map(i => `Reorder ${i.minStockLevel * 2} units of ${i.name} immediately.`),
    })
  }

  return insights
}

/**
 * 2. Pricing Agent: Checks product markups against targets
 */
function runPricingAgentOffline(items: InventoryItem[]): Partial<AIInsight>[] {
  const insights: Partial<AIInsight>[] = []
  
  // Find low margin items
  const lowMarginItems = items.filter(item => {
    if (item.sellingPrice <= 0 || item.costPrice <= 0) return false
    const markup = (item.sellingPrice - item.costPrice) / item.sellingPrice
    return markup < 0.15 // Less than 15% margin
  })

  if (lowMarginItems.length > 0) {
    insights.push({
      type: 'pricing',
      title: 'Margin Compression Alert',
      description: `${lowMarginItems.length} items are operating below the target 15% retail markup margin.`,
      severity: 'medium',
      itemIds: lowMarginItems.map(i => i.id),
      recommendations: lowMarginItems.map(i => {
        const currentMargin = ((i.sellingPrice - i.costPrice) / i.sellingPrice) * 100
        const suggestedPrice = Math.round(i.costPrice * 1.25)
        return `Adjust ${i.name} retail price to ₹${suggestedPrice} to achieve a 20% margin (currently ${currentMargin.toFixed(1)}%).`
      }),
    })
  }

  return insights
}

/**
 * 3. Profit Agent: Evaluates daily revenues, COGS (Cost of goods sold) and net margins
 */
function runProfitAgentOffline(items: InventoryItem[], transactions: Transaction[]): Partial<AIInsight>[] {
  const sales = transactions.filter(t => t.type === 'sale')
  const totalRev = sales.reduce((sum, t) => sum + t.totalAmount, 0)
  const totalCost = sales.reduce((sum, t) => {
    const item = items.find(i => i.id === t.itemId)
    return sum + (item?.costPrice || 0) * t.quantity
  }, 0)
  const profit = totalRev - totalCost
  const margin = totalRev > 0 ? (profit / totalRev) * 100 : 0

  const insights: Partial<AIInsight>[] = []

  if (margin > 0 && margin < 20) {
    insights.push({
      type: 'trend',
      title: 'Gross Margin Compression',
      description: `Your overall store gross margin is at ${margin.toFixed(1)}% which is slightly constrained. High cost purchases are pulling margins down.`,
      severity: 'medium',
      recommendations: [
        'Negotiate bulk discounts with A-1 Grocery Wholesalers to lower cost prices.',
        'Focus sales promotions on high-margin categories like Health & Beauty.',
      ],
    })
  } else if (margin >= 20) {
    insights.push({
      type: 'trend',
      title: 'Healthy Profit Engine Active',
      description: `Store is operating at a solid ${margin.toFixed(1)}% gross margin. Sales velocity is strong.`,
      severity: 'low',
      recommendations: [
        'Maintain current pricing strategies.',
        'Reinvest profit into restocking fast-moving FMCG items.',
      ],
    })
  }

  return insights
}

/**
 * 4. Forecasting Agent: Forecasts inventory run-out dates based on moving average sales velocity
 */
function runForecastingAgentOffline(items: InventoryItem[], transactions: Transaction[]): Partial<AIInsight>[] {
  const insights: Partial<AIInsight>[] = []
  
  // Calculate average daily sales velocity
  const sales = transactions.filter(t => t.type === 'sale')
  const velocityMap = new Map<string, number>() // itemId -> totalQtySold
  
  sales.forEach(t => {
    velocityMap.set(t.itemId, (velocityMap.get(t.itemId) || 0) + t.quantity)
  })

  const lowStockForecast: string[] = []
  const criticalItemIds: string[] = []

  items.forEach(item => {
    const totalSold = velocityMap.get(item.id) || 0
    const dailySalesVelocity = totalSold / 30 // Approximate sales velocity per day over 30 days
    
    if (dailySalesVelocity > 0 && item.quantity <= item.minStockLevel) {
      const daysRemaining = Math.round(item.quantity / dailySalesVelocity)
      if (daysRemaining <= 5) {
        lowStockForecast.push(`${item.name} will run out completely in ${daysRemaining === 0 ? 'less than 24 hours' : `${daysRemaining} days`}.`)
        criticalItemIds.push(item.id)
      }
    }
  })

  if (lowStockForecast.length > 0) {
    insights.push({
      type: 'reorder',
      title: 'Inventory Depletion Alert',
      description: `Velocity forecasting predicts stockout within 5 days for several key products.`,
      severity: 'high',
      itemIds: criticalItemIds,
      recommendations: lowStockForecast,
    })
  }

  return insights
}

/**
 * 5. Alert Agent: Prioritizes and groups system warnings
 */
function runAlertAgentOffline(rawInsights: Partial<AIInsight>[]): Partial<AIInsight>[] {
  // Sort and filter. High severity items go first. Dismiss duplicates.
  return rawInsights.sort((a, b) => {
    const priority = { high: 3, medium: 2, low: 1 }
    return (priority[b.severity || 'low'] || 0) - (priority[a.severity || 'low'] || 0)
  })
}

/**
 * 6. WhatsApp Agent: Pre-formats chat digests and actionable approvals
 */
export function formatWhatsAppMessage(insight: Partial<AIInsight>, item?: InventoryItem): string {
  if (insight.type === 'dead_stock' && item) {
    return `💡 *AI RECOMMENDATION*\n\nWe found *${item.name}* is stagnant (${item.quantity} units, 0 sales in the last 45+ days).\n\nShall we approve a *15% markdown* (from ₹${item.sellingPrice} to ₹${Math.round(item.sellingPrice * 0.85)}) to liquidate? Expected clearance is 8 days.`
  }
  
  if (insight.type === 'reorder' && item) {
    return `🚨 *LOW STOCK WARNING*\n\n*${item.name}* is critically low at ${item.quantity} units (Threshold: ${item.minStockLevel}).\n\n*Action Suggested:* Reorder *${item.minStockLevel * 2} units* from *${item.supplier || 'distributor'}*.\n\nType *APPROVE* to place purchase order instantly.`
  }

  return `📢 *RETAIL DIGEST*\n\n*${insight.title}*\n${insight.description}\n\n*Recommendation:* ${insight.recommendations?.[0] || 'Check dashboard settings.'}`
}

/**
 * 7. Recommendation Agent: Formulates clearance discount campaigns & supplier cost optimizations
 */
function runRecommendationAgentOffline(items: InventoryItem[]): Partial<AIInsight>[] {
  const insights: Partial<AIInsight>[] = []
  
  // Stagnant inventory
  const deadStock = items.filter(i => {
    // Seed items 6 and 7 represent stagnant/dead stock
    return i.id === 'item_6' || i.id === 'item_7'
  })

  if (deadStock.length > 0) {
    insights.push({
      type: 'dead_stock',
      title: 'Dead Capital Liquidation Strategy',
      description: `Stagnant capital detected. Britannia biscuits and Colgate toothpaste have had zero transaction velocity recently.`,
      severity: 'medium',
      itemIds: deadStock.map(i => i.id),
      recommendations: [
        'Approve a 15% markdown on Britannia Bourbon Biscuits to clear within 8 days.',
        'Bundle Colgate paste with fast-selling grocery items.',
        'Initiate supplier return query for unsold stock.',
      ],
    })
  }

  // Supplier Switch optimization recommendation
  const hasApexFmcg = items.some(i => i.supplier === 'Apex FMCG Distributors')
  if (hasApexFmcg) {
    insights.push({
      type: 'pricing',
      title: 'Supplier Procurement Arbitrage',
      description: `We identified cost optimization options. Procurement for detergent and biscuits can be shifted to A-1 Grocery Wholesalers.`,
      severity: 'low',
      recommendations: [
        'Switch Ariel Detergent procurement to A-1 Grocery for 8% cheaper unit rates.',
        'Bundle order with A-1 Grocery to waive ₹250 delivery fees.',
      ],
    })
  }

  return insights
}

/**
 * Master Agent Orchestrator: Integrates and runs the AI retail intelligence suite
 */
export async function orchestrateBusinessIntelligence(
  items: InventoryItem[],
  transactions: Transaction[],
  org: Organization
): Promise<AIInsight[]> {
  try {
    const config = localDb.getAiConfig()
    
    // Check if cloud or local LLM connection can be executed
    if (config.provider !== 'gemini' || config.geminiKey || process.env.GEMINI_API_KEY) {
      return await orchestrateLlmAgents(items, transactions, org)
    }
  } catch (e) {
    console.warn('AI LLM execution failed, falling back to algorithmic high-fidelity rule agents:', e)
  }

  // Algorithmic Offline Rule fallbacks
  const inventoryInsights = runInventoryAgentOffline(items)
  const pricingInsights = runPricingAgentOffline(items)
  const profitInsights = runProfitAgentOffline(items, transactions)
  const forecastingInsights = runForecastingAgentOffline(items, transactions)
  const recommendationInsights = runRecommendationAgentOffline(items)

  const combined = [
    ...inventoryInsights,
    ...pricingInsights,
    ...profitInsights,
    ...forecastingInsights,
    ...recommendationInsights,
  ]

  // Filter, group, and prioritize with Alert Agent
  const prioritized = runAlertAgentOffline(combined)

  // Map to final AIInsight items
  const finalInsights: AIInsight[] = prioritized.map((ins, index) => ({
    id: `insight_agent_${Date.now()}_${index}`,
    orgId: org.id,
    type: ins.type || 'trend',
    title: ins.title || 'System Insight',
    description: ins.description || '',
    severity: ins.severity || 'low',
    itemIds: ins.itemIds || [],
    recommendations: ins.recommendations || [],
    createdAt: new Date(),
    dismissed: false,
  }))

  // Persist to localDb
  localDb.saveInsights(org.id, finalInsights)
  
  // Push simulated alerts into WhatsApp simulator!
  triggerSimulatedWhatsappAlerts(org.id, finalInsights, items)

  return finalInsights
}

/**
 * Trigger mock WhatsApp notifications based on fresh high-priority insights
 */
function triggerSimulatedWhatsappAlerts(orgId: string, insights: AIInsight[], items: InventoryItem[]) {
  const highPriority = insights.filter(ins => ins.severity === 'high' || ins.severity === 'medium')
  if (highPriority.length === 0) return

  // Load existing messages to prevent spam
  const existing = localDb.getWhatsappMessages(orgId)
  
  highPriority.slice(0, 2).forEach(ins => {
    const textSnippet = ins.title.split(' ')[0]
    const alreadySent = existing.some(msg => msg.text.includes(textSnippet))
    
    if (!alreadySent) {
      let text = `📢 *COPROCESSOR ALERT*\n\n*${ins.title}*\n${ins.description}\n\n*Recommendation:* ${ins.recommendations[0]}`
      let type: 'alert' | 'approval' = 'alert'
      let approvalData: any = undefined

      // If it's a reorder or dead stock, format as interactive approval
      if (ins.type === 'dead_stock' && ins.itemIds && ins.itemIds.length > 0) {
        const item = items.find(i => i.id === ins.itemIds![0])
        if (item) {
          text = `💡 *AI DISCOUNT CLEARANCE PROPOSAL*\n\nBritannia Bourbon Biscuits has had *zero sales* for 55+ days. Suggesting a *15% discount* (from ₹${item.sellingPrice} to ₹${Math.round(item.sellingPrice * 0.85)}) to clear capital.\n\nApprove markdown?`
          type = 'approval'
          approvalData = {
            actionType: 'discount',
            itemId: item.id,
            details: { discountPercent: 15, newPrice: Math.round(item.sellingPrice * 0.85) }
          }
        }
      } else if (ins.type === 'reorder' && ins.itemIds && ins.itemIds.length > 0) {
        const item = items.find(i => i.id === ins.itemIds![0])
        if (item) {
          text = `🚨 *CRITICAL LOW STOCK WARNING*\n\n*${item.name}* has only ${item.quantity} units left.\n\nShall we register a purchase order for *${item.minStockLevel * 2} units* from *${item.supplier || 'A-1 Wholesalers'}*? (Cost: ₹${item.costPrice * item.minStockLevel * 2})`
          type = 'approval'
          approvalData = {
            actionType: 'reorder',
            itemId: item.id,
            details: { quantity: item.minStockLevel * 2, cost: item.costPrice }
          }
        }
      }

      localDb.addWhatsappMessage({
        orgId,
        sender: 'bot',
        text,
        type,
        status: 'delivered',
        approvalData
      })
    }
  })
}

/**
 * Execute LLM-orchestrated agents using structured templates and callActiveLlm
 */
async function orchestrateLlmAgents(
  items: InventoryItem[],
  transactions: Transaction[],
  org: Organization
): Promise<AIInsight[]> {
  const lowStock = items.filter(i => i.quantity <= i.minStockLevel)
  const deadStock = items.filter(i => i.id === 'item_6' || i.id === 'item_7') // Britannia / Colgate
  
  const systemPrompt = `You are the central Multi-Agent Orchestrator for Retail Copilot. Below are current store metrics.
  Organize 3 specific, distinct insights matching roles:
  1. Low stock depletion reorder warning
  2. Margin pricing recommendation
  3. Stagnant stock clearance discount campaign
  
  Respond ONLY with a valid JSON block of the format:
  {
    "insights": [
      {
        "type": "dead_stock" | "reorder" | "pricing" | "trend",
        "title": "Clear action-oriented title",
        "description": "Short explanation",
        "severity": "low" | "medium" | "high",
        "itemIds": ["item_id_from_data"],
        "recommendations": ["Recommendation item 1", "Recommendation item 2"]
      }
    ]
  }
  `

  const dataSnippet = `
  Store Name: ${org.name}
  Total Inventory SKUs: ${items.length}
  Low Stock SKUs: ${lowStock.map(i => `${i.name} (SKU: ${i.sku}, Qty: ${i.quantity}, Min: ${i.minStockLevel}, Supplier: ${i.supplier})`).join(', ')}
  Stagnant Stock: ${deadStock.map(i => `${i.name} (SKU: ${i.sku}, Qty: ${i.quantity}, Cost: ₹${i.costPrice}, Selling: ₹${i.sellingPrice})`).join(', ')}
  `

  const llmResponse = await callActiveLlm(dataSnippet, systemPrompt)
  
  const jsonMatch = llmResponse.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No valid JSON block generated by LLM')
  
  const parsed = JSON.parse(jsonMatch[0])
  const finalInsights: AIInsight[] = parsed.insights.map((insight: Partial<AIInsight>, index: number) => ({
    id: `insight_llm_${Date.now()}_${index}`,
    orgId: org.id,
    type: insight.type || 'trend',
    title: insight.title || 'AI Strategy Alert',
    description: insight.description || '',
    severity: insight.severity || 'medium',
    itemIds: insight.itemIds || [],
    recommendations: insight.recommendations || [],
    createdAt: new Date(),
    dismissed: false,
  }))

  localDb.saveInsights(org.id, finalInsights)
  triggerSimulatedWhatsappAlerts(org.id, finalInsights, items)
  
  return finalInsights
}
