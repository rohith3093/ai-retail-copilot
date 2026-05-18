// Organization Types
export interface Organization {
  id: string
  name: string
  slug: string
  ownerId: string
  createdAt: Date
  updatedAt: Date
  settings: OrgSettings
}

export interface OrgSettings {
  currency: string
  taxRate: number
  lowStockThreshold: number
  deadStockDays: number
}

// User Types
export type UserRole = 'owner' | 'manager' | 'staff'

export interface User {
  id: string
  email: string
  displayName: string
  photoURL?: string
  createdAt: Date
  updatedAt: Date
}

export interface OrgMember {
  id: string
  orgId: string
  userId: string
  role: UserRole
  joinedAt: Date
}

// Inventory Types
export interface InventoryItem {
  id: string
  orgId: string
  sku: string
  name: string
  description?: string
  category: string
  quantity: number
  costPrice: number
  sellingPrice: number
  minStockLevel: number
  supplier?: string
  imageUrl?: string
  lastRestocked?: Date
  createdAt: Date
  updatedAt: Date
}

// Transaction Types
export type TransactionType = 'sale' | 'purchase' | 'adjustment' | 'return'

export interface Transaction {
  id: string
  orgId: string
  itemId: string
  type: TransactionType
  quantity: number
  unitPrice: number
  totalAmount: number
  notes?: string
  createdBy: string
  createdAt: Date
}

// Analytics Types
export interface DailyStats {
  date: string
  totalSales: number
  totalCost: number
  profit: number
  itemsSold: number
  transactionCount: number
}

export interface InventoryAnalytics {
  totalItems: number
  totalValue: number
  lowStockItems: number
  deadStockItems: number
  topSellingItems: { itemId: string; name: string; quantity: number }[]
  categoryBreakdown: { category: string; count: number; value: number }[]
}

// AI Types
export interface AIInsight {
  id: string
  orgId: string
  type: 'dead_stock' | 'reorder' | 'pricing' | 'trend'
  title: string
  description: string
  severity: 'low' | 'medium' | 'high'
  itemIds?: string[]
  recommendations: string[]
  createdAt: Date
  dismissed: boolean
}

// Dashboard Types
export interface DashboardData {
  stats: {
    totalRevenue: number
    totalProfit: number
    totalItems: number
    lowStockCount: number
    revenueChange: number
    profitChange: number
  }
  recentTransactions: Transaction[]
  topProducts: { item: InventoryItem; soldQuantity: number; revenue: number }[]
  salesChart: { date: string; sales: number; profit: number }[]
  categoryChart: { category: string; value: number }[]
}

// Form Types
export interface InventoryFormData {
  sku: string
  name: string
  description?: string
  category: string
  quantity: number
  costPrice: number
  sellingPrice: number
  minStockLevel: number
  supplier?: string
}

export interface TransactionFormData {
  itemId: string
  type: TransactionType
  quantity: number
  unitPrice: number
  notes?: string
}
