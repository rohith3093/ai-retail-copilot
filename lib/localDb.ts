import type { User, Organization, OrgMember, InventoryItem, Transaction, AIInsight } from './types'

// Local Auth Session Keys
const STORAGE_PREFIX = 'retail_copilot_'

export interface LocalAiConfig {
  provider: 'gemini' | 'openai' | 'ollama' | 'lmstudio'
  ollamaUrl: string
  ollamaModel: string
  openAiKey: string
  geminiKey: string
}

export interface WhatsappSimMessage {
  id: string
  orgId: string
  sender: 'user' | 'bot'
  text: string
  type: 'text' | 'alert' | 'approval'
  status: 'sent' | 'delivered' | 'read'
  approvalData?: {
    actionType: 'discount' | 'reorder' | 'supplier_switch'
    itemId: string
    details: Record<string, any>
  }
  timestamp: string
}

export interface SupplierProfile {
  id: string
  orgId: string
  name: string
  contactEmail: string
  contactPhone: string
  reliabilityScore: number // 1-100
  itemsSuppliedCount: number
  leadTimeDays: number
  costTrend: 'rising' | 'stable' | 'falling'
  baseDiscountPercentage: number
}

// Check if code is running on client
const isClient = typeof window !== 'undefined'

const getStorage = <T>(key: string, defaultValue: T): T => {
  if (!isClient) return defaultValue
  const stored = localStorage.getItem(STORAGE_PREFIX + key)
  if (!stored) {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(defaultValue))
    return defaultValue
  }
  try {
    return JSON.parse(stored) as T
  } catch (e) {
    console.error(`Error parsing local storage for key ${key}`, e)
    return defaultValue
  }
}

const setStorage = <T>(key: string, value: T): void => {
  if (!isClient) return
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
}

// Generate Seed Data
const generateSeedData = () => {
  if (!isClient) return

  // 1. Seed User
  const seedUser: User = {
    id: 'demo_owner_123',
    email: 'owner@retailbot.co',
    displayName: 'Rohith Menon',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // 2. Seed Org
  const seedOrg: Organization = {
    id: 'demo_org_123',
    name: 'Sharma Supermarket',
    slug: 'sharma-supermarket',
    ownerId: seedUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    settings: {
      currency: 'INR',
      taxRate: 18,
      lowStockThreshold: 15,
      deadStockDays: 45,
    },
  }

  // 3. Seed Membership
  const seedMember: OrgMember = {
    id: 'demo_member_123',
    orgId: seedOrg.id,
    userId: seedUser.id,
    role: 'owner',
    joinedAt: new Date(),
  }

  // 4. Seed Suppliers
  const seedSuppliers: SupplierProfile[] = [
    {
      id: 'sup_1',
      orgId: seedOrg.id,
      name: 'A-1 Grocery Wholesalers',
      contactEmail: 'orders@a1grocery.in',
      contactPhone: '+91 98765 43210',
      reliabilityScore: 92,
      itemsSuppliedCount: 15,
      leadTimeDays: 2,
      costTrend: 'stable',
      baseDiscountPercentage: 3,
    },
    {
      id: 'sup_2',
      orgId: seedOrg.id,
      name: 'Apex FMCG Distributors',
      contactEmail: 'sales@apexfmcg.co.in',
      contactPhone: '+91 88888 77777',
      reliabilityScore: 84,
      itemsSuppliedCount: 22,
      leadTimeDays: 4,
      costTrend: 'rising',
      baseDiscountPercentage: 5,
    },
    {
      id: 'sup_3',
      orgId: seedOrg.id,
      name: 'Radhe Dairy & Beverages',
      contactEmail: 'radhedairy@outlook.com',
      contactPhone: '+91 77777 66666',
      reliabilityScore: 98,
      itemsSuppliedCount: 8,
      leadTimeDays: 1,
      costTrend: 'falling',
      baseDiscountPercentage: 2,
    },
  ]

  // 5. Seed Inventory
  const seedInventory: InventoryItem[] = [
    {
      id: 'item_1',
      orgId: seedOrg.id,
      sku: 'FMCG-DM-01',
      name: 'Dairy Milk Silk Chocolate',
      description: 'Cadbury Dairy Milk Silk Chocolate Bar, 150g',
      category: 'Food & Beverages',
      quantity: 120,
      costPrice: 70,
      sellingPrice: 90,
      minStockLevel: 25,
      supplier: 'Apex FMCG Distributors',
      lastRestocked: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'item_2',
      orgId: seedOrg.id,
      sku: 'FMCG-MG-02',
      name: 'Maggi 2-Min Masala Noodles',
      description: 'Maggi instant masala noodles, pack of 12',
      category: 'Food & Beverages',
      quantity: 8, // Low Stock!
      costPrice: 12,
      sellingPrice: 14,
      minStockLevel: 20,
      supplier: 'A-1 Grocery Wholesalers',
      lastRestocked: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'item_3',
      orgId: seedOrg.id,
      sku: 'FMCG-BR-03',
      name: 'India Gate Basmati Rice 5kg',
      description: 'Premium long grain basmati rice, 5kg bag',
      category: 'Food & Beverages',
      quantity: 45,
      costPrice: 350,
      sellingPrice: 450,
      minStockLevel: 15,
      supplier: 'A-1 Grocery Wholesalers',
      lastRestocked: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'item_4',
      orgId: seedOrg.id,
      sku: 'FMCG-TS-04',
      name: 'Tata Salt Lite 1kg',
      description: 'Tata iodine table salt, 1kg pack',
      category: 'Food & Beverages',
      quantity: 80,
      costPrice: 20,
      sellingPrice: 25,
      minStockLevel: 10,
      supplier: 'A-1 Grocery Wholesalers',
      lastRestocked: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'item_5',
      orgId: seedOrg.id,
      sku: 'HOME-AR-05',
      name: 'Ariel Detergent Powder 1kg',
      description: 'Ariel complete matic front load powder, 1kg',
      category: 'Home & Garden',
      quantity: 3, // Low Stock!
      costPrice: 110,
      sellingPrice: 140,
      minStockLevel: 8,
      supplier: 'Apex FMCG Distributors',
      lastRestocked: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'item_6',
      orgId: seedOrg.id,
      sku: 'FMCG-BB-06',
      name: 'Britannia Bourbon Biscuits',
      description: 'Bourbon chocolate cream biscuits, 150g pack',
      category: 'Food & Beverages',
      quantity: 95, // High quantity, no sales! Dead Stock!
      costPrice: 22,
      sellingPrice: 30,
      minStockLevel: 15,
      supplier: 'Apex FMCG Distributors',
      lastRestocked: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'item_7',
      orgId: seedOrg.id,
      sku: 'HB-CG-07',
      name: 'Colgate Total Toothpaste 150g',
      description: 'Colgate multi-benefit active charcoal paste',
      category: 'Health & Beauty',
      quantity: 60, // High stock, no sales! Dead Stock!
      costPrice: 45,
      sellingPrice: 65,
      minStockLevel: 10,
      supplier: 'Apex FMCG Distributors',
      lastRestocked: new Date(Date.now() - 48 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 48 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'item_8',
      orgId: seedOrg.id,
      sku: 'HB-PC-08',
      name: 'Parachute Coconut Hair Oil 250ml',
      description: '100% pure coconut oil for hair health',
      category: 'Health & Beauty',
      quantity: 18,
      costPrice: 90,
      sellingPrice: 110,
      minStockLevel: 10,
      supplier: 'A-1 Grocery Wholesalers',
      lastRestocked: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    },
  ]

  // 6. Seed Transactions (generate last 30 days of sales / purchase logs for chart consistency)
  const seedTransactions: Transaction[] = []
  
  // Generate historical sales
  const days = 30
  let txIdCounter = 1
  
  for (let i = days; i >= 0; i--) {
    const txDate = new Date()
    txDate.setDate(txDate.getDate() - i)
    txDate.setHours(10 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60))

    // Record 2 to 6 transactions daily
    const numDailyTx = i === 0 ? 3 : 2 + Math.floor(Math.random() * 5)
    for (let j = 0; j < numDailyTx; j++) {
      // Pick random item (items 1 to 4 and 8 sell frequently. 6 and 7 do not sell, creating dead stock)
      const frequentItems = ['item_1', 'item_2', 'item_3', 'item_4', 'item_8']
      const itemId = frequentItems[Math.floor(Math.random() * frequentItems.length)]
      const item = seedInventory.find((inv) => inv.id === itemId)!

      const qty = 1 + Math.floor(Math.random() * 4)
      const tx: Transaction = {
        id: `tx_${Date.now()}_${txIdCounter++}`,
        orgId: seedOrg.id,
        itemId: item.id,
        type: 'sale',
        quantity: qty,
        unitPrice: item.sellingPrice,
        totalAmount: qty * item.sellingPrice,
        createdBy: 'demo_owner_123',
        createdAt: txDate,
        notes: 'Counter sales',
      }
      seedTransactions.push(tx)
    }

    // Add occasional restocking purchases
    if (i % 8 === 0) {
      const restockItem = seedInventory[Math.floor(Math.random() * seedInventory.length)]
      const purchaseQty = 20 + Math.floor(Math.random() * 30)
      const purchaseTx: Transaction = {
        id: `tx_${Date.now()}_${txIdCounter++}`,
        orgId: seedOrg.id,
        itemId: restockItem.id,
        type: 'purchase',
        quantity: purchaseQty,
        unitPrice: restockItem.costPrice,
        totalAmount: purchaseQty * restockItem.costPrice,
        createdBy: 'demo_owner_123',
        createdAt: txDate,
        notes: `Restocked from ${restockItem.supplier || 'Supplier'}`,
      }
      seedTransactions.push(purchaseTx)
    }
  }

  // 7. Seed AI Insights
  const seedInsights: AIInsight[] = [
    {
      id: 'insight_seed_1',
      orgId: seedOrg.id,
      type: 'dead_stock',
      title: 'Britannia Bourbon Biscuits Stagnant Stock',
      description: 'Bourbon biscuits have high inventory (95 units) with 0 sales in the last 55 days, tying up ₹2,090 of capital.',
      severity: 'medium',
      itemIds: ['item_6'],
      recommendations: [
        'Recommend 15% discount clearance sale.',
        'Bundle Bourbon biscuits with fast-moving Dairy Milk chocolate.',
        'Reduce future reorders from Apex FMCG Distributors.',
      ],
      createdAt: new Date(),
      dismissed: false,
    },
    {
      id: 'insight_seed_2',
      orgId: seedOrg.id,
      type: 'reorder',
      title: 'Ariel Detergent Critical Stock Level',
      description: 'Ariel Detergent has fallen to 3 units (min threshold is 8). Estimated run-out in 2 days based on velocity.',
      severity: 'high',
      itemIds: ['item_5'],
      recommendations: [
        'Reorder 25 units from Apex FMCG Distributors immediately.',
        'Check A-1 Grocery for lower pricing (typically 5% cheaper on home goods).',
      ],
      createdAt: new Date(),
      dismissed: false,
    },
    {
      id: 'insight_seed_3',
      orgId: seedOrg.id,
      type: 'pricing',
      title: 'Maggi Masala Low Profit Margin Alert',
      description: 'Maggi Noodles are running on a tight markup margin of 14.2% (Cost ₹12, Selling ₹14) which is below the category average of 25%.',
      severity: 'low',
      itemIds: ['item_2'],
      recommendations: [
        'Increase selling price to ₹15 (increases margin to 20%).',
        'Procure in bulk from A-1 Grocery to lower cost to ₹11.',
      ],
      createdAt: new Date(),
      dismissed: false,
    },
  ]

  // 8. Seed AI Config
  const seedAiConfig: LocalAiConfig = {
    provider: 'gemini',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3',
    openAiKey: '',
    geminiKey: '',
  }

  // 9. Seed WhatsApp Messages
  const seedWhatsapp: WhatsappSimMessage[] = [
    {
      id: 'msg_1',
      orgId: seedOrg.id,
      sender: 'bot',
      text: '🤖 Welcome to your AI Retail Copilot Assistant! I will send you critical alerts, insights, and quick approvals here.',
      type: 'text',
      status: 'read',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg_2',
      orgId: seedOrg.id,
      sender: 'bot',
      text: '🚨 *LOW STOCK ALERT*\nAriel Detergent Powder 1kg is at 3 units (threshold: 8).\n\nSupplier: Apex FMCG Distributors\nCost: ₹110 / unit',
      type: 'alert',
      status: 'read',
      timestamp: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg_3',
      orgId: seedOrg.id,
      sender: 'bot',
      text: '💡 *AI RECOMMENDATION*\nWe found Britannia Bourbon Biscuits are stagnant (95 units, 0 sales in 55 days).\n\nShall we approve a *15% discount* (from ₹30 to ₹25.5) to clear this stock? Expected clearance in 8 days.',
      type: 'approval',
      status: 'delivered',
      approvalData: {
        actionType: 'discount',
        itemId: 'item_6',
        details: { discountPercent: 15, newPrice: 25.5 },
      },
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
  ]

  // Write all to localStorage
  localStorage.setItem(STORAGE_PREFIX + 'users', JSON.stringify([seedUser]))
  localStorage.setItem(STORAGE_PREFIX + 'organizations', JSON.stringify([seedOrg]))
  localStorage.setItem(STORAGE_PREFIX + 'org_members', JSON.stringify([seedMember]))
  localStorage.setItem(STORAGE_PREFIX + 'suppliers', JSON.stringify(seedSuppliers))
  localStorage.setItem(STORAGE_PREFIX + 'inventory', JSON.stringify(seedInventory))
  localStorage.setItem(STORAGE_PREFIX + 'transactions', JSON.stringify(seedTransactions))
  localStorage.setItem(STORAGE_PREFIX + 'insights', JSON.stringify(seedInsights))
  localStorage.setItem(STORAGE_PREFIX + 'ai_config', JSON.stringify(seedAiConfig))
  localStorage.setItem(STORAGE_PREFIX + 'whatsapp_messages', JSON.stringify(seedWhatsapp))
}

// Initial Bootstrapping
if (isClient) {
  const isSeeded = localStorage.getItem(STORAGE_PREFIX + 'users')
  if (!isSeeded) {
    generateSeedData()
  }
}

// Exportable Local Database Methods
export const localDb = {
  // Reset
  resetDb: () => {
    if (!isClient) return
    localStorage.clear()
    generateSeedData()
    window.location.reload()
  },

  // Auth Operations
  getUsers: () => getStorage<User[]>('users', []),
  saveUser: (user: User) => {
    const users = localDb.getUsers()
    const existingIdx = users.findIndex((u) => u.id === user.id)
    if (existingIdx > -1) {
      users[existingIdx] = user
    } else {
      users.push(user)
    }
    setStorage('users', users)
  },

  // Organization Operations
  getOrgs: () => getStorage<Organization[]>('organizations', []),
  getOrgMemberships: (userId: string) => {
    const memberships = getStorage<OrgMember[]>('org_members', [])
    return memberships.filter((m) => m.userId === userId)
  },
  createOrg: (name: string, userId: string): Organization => {
    const orgs = localDb.getOrgs()
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const newOrg: Organization = {
      id: `org_${Date.now()}`,
      name,
      slug,
      ownerId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        currency: 'INR',
        taxRate: 18,
        lowStockThreshold: 15,
        deadStockDays: 45,
      },
    }
    orgs.push(newOrg)
    setStorage('organizations', orgs)

    const memberships = getStorage<OrgMember[]>('org_members', [])
    memberships.push({
      id: `member_${Date.now()}`,
      orgId: newOrg.id,
      userId,
      role: 'owner',
      joinedAt: new Date(),
    })
    setStorage('org_members', memberships)

    return newOrg
  },
  updateOrgSettings: (orgId: string, name: string, settings: Organization['settings']) => {
    const orgs = localDb.getOrgs()
    const idx = orgs.findIndex((o) => o.id === orgId)
    if (idx > -1) {
      orgs[idx] = {
        ...orgs[idx],
        name,
        settings,
        updatedAt: new Date(),
      }
      setStorage('organizations', orgs)
    }
  },

  // Inventory Operations
  getItems: (orgId: string) => {
    const all = getStorage<InventoryItem[]>('inventory', [])
    return all.filter((i) => i.orgId === orgId)
  },
  addItem: (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const all = getStorage<InventoryItem[]>('inventory', [])
    const newItem: InventoryItem = {
      ...item,
      id: item.id || `item_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    all.unshift(newItem)
    setStorage('inventory', all)
    return newItem
  },
  updateItem: (itemId: string, updates: Partial<InventoryItem>) => {
    const all = getStorage<InventoryItem[]>('inventory', [])
    const idx = all.findIndex((i) => i.id === itemId)
    if (idx > -1) {
      all[idx] = {
        ...all[idx],
        ...updates,
        updatedAt: new Date(),
      }
      setStorage('inventory', all)
    }
  },
  removeItem: (itemId: string) => {
    const all = getStorage<InventoryItem[]>('inventory', [])
    const filtered = all.filter((i) => i.id !== itemId)
    setStorage('inventory', filtered)
  },

  // Transaction Operations
  getTransactions: (orgId: string) => {
    const all = getStorage<Transaction[]>('transactions', [])
    return all
      .filter((t) => t.orgId === orgId)
      .map((t) => ({ ...t, createdAt: new Date(t.createdAt) }))
  },
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => {
    const all = getStorage<Transaction[]>('transactions', [])
    const newTx: Transaction = {
      ...tx,
      id: `tx_${Date.now()}`,
      createdAt: new Date(),
    }
    all.unshift(newTx)
    setStorage('transactions', all)

    // Automatically update inventory quantity!
    const inventoryItems = getStorage<InventoryItem[]>('inventory', [])
    const itemIdx = inventoryItems.findIndex((i) => i.id === tx.itemId)
    if (itemIdx > -1) {
      const item = inventoryItems[itemIdx]
      const change = tx.type === 'sale' || tx.type === 'adjustment' && tx.quantity < 0
        ? -Math.abs(tx.quantity)
        : Math.abs(tx.quantity)
      
      const newQty = Math.max(0, item.quantity + change)
      inventoryItems[itemIdx] = {
        ...item,
        quantity: newQty,
        lastRestocked: tx.type === 'purchase' ? new Date() : item.lastRestocked,
        updatedAt: new Date(),
      }
      setStorage('inventory', inventoryItems)
    }

    return newTx
  },

  // Supplier Operations
  getSuppliers: (orgId: string) => {
    const all = getStorage<SupplierProfile[]>('suppliers', [])
    return all.filter((s) => s.orgId === orgId)
  },
  saveSupplier: (supplier: SupplierProfile) => {
    const all = getStorage<SupplierProfile[]>('suppliers', [])
    const idx = all.findIndex((s) => s.id === supplier.id)
    if (idx > -1) {
      all[idx] = supplier
    } else {
      all.push(supplier)
    }
    setStorage('suppliers', all)
  },

  // Insights Operations
  getInsights: (orgId: string) => {
    const all = getStorage<AIInsight[]>('insights', [])
    return all.filter((i) => i.orgId === orgId)
  },
  saveInsights: (orgId: string, insights: AIInsight[]) => {
    const all = getStorage<AIInsight[]>('insights', [])
    const filtered = all.filter((i) => i.orgId !== orgId) // Replace existing insights
    setStorage('insights', [...insights, ...filtered])
  },
  dismissInsight: (insightId: string) => {
    const all = getStorage<AIInsight[]>('insights', [])
    const idx = all.findIndex((i) => i.id === insightId)
    if (idx > -1) {
      all[idx].dismissed = true
      setStorage('insights', all)
    }
  },

  // AI Configuration Operations
  getAiConfig: () => {
    return getStorage<LocalAiConfig>('ai_config', {
      provider: 'gemini',
      ollamaUrl: 'http://localhost:11434',
      ollamaModel: 'llama3',
      openAiKey: '',
      geminiKey: '',
    })
  },
  saveAiConfig: (config: LocalAiConfig) => {
    setStorage('ai_config', config)
  },

  // WhatsApp Operations
  getWhatsappMessages: (orgId: string) => {
    const all = getStorage<WhatsappSimMessage[]>('whatsapp_messages', [])
    return all.filter((w) => w.orgId === orgId)
  },
  saveWhatsappMessages: (orgId: string, messages: WhatsappSimMessage[]) => {
    const all = getStorage<WhatsappSimMessage[]>('whatsapp_messages', [])
    const filtered = all.filter((w) => w.orgId !== orgId)
    setStorage('whatsapp_messages', [...filtered, ...messages])
  },
  addWhatsappMessage: (msg: Omit<WhatsappSimMessage, 'id' | 'timestamp'>) => {
    const all = getStorage<WhatsappSimMessage[]>('whatsapp_messages', [])
    const newMsg: WhatsappSimMessage = {
      ...msg,
      id: `msg_${Date.now()}`,
      timestamp: new Date().toISOString(),
    }
    all.push(newMsg)
    setStorage('whatsapp_messages', all)
    return newMsg
  },
  updateWhatsappMessageStatus: (msgId: string, status: WhatsappSimMessage['status']) => {
    const all = getStorage<WhatsappSimMessage[]>('whatsapp_messages', [])
    const idx = all.findIndex((w) => w.id === msgId)
    if (idx > -1) {
      all[idx].status = status
      setStorage('whatsapp_messages', all)
    }
  },
}
