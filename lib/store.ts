import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Organization, InventoryItem, Transaction, AIInsight, OrgMember } from './types'

// Auth Store
interface AuthState {
  user: User | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
}))

// Organization Store
interface OrgState {
  currentOrg: Organization | null
  orgs: Organization[]
  members: OrgMember[]
  userRole: 'owner' | 'manager' | 'staff' | null
  setCurrentOrg: (org: Organization | null) => void
  setOrgs: (orgs: Organization[]) => void
  setMembers: (members: OrgMember[]) => void
  setUserRole: (role: 'owner' | 'manager' | 'staff' | null) => void
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      currentOrg: null,
      orgs: [],
      members: [],
      userRole: null,
      setCurrentOrg: (currentOrg) => set({ currentOrg }),
      setOrgs: (orgs) => set({ orgs }),
      setMembers: (members) => set({ members }),
      setUserRole: (userRole) => set({ userRole }),
    }),
    {
      name: 'org-storage',
      partialize: (state) => ({ currentOrg: state.currentOrg }),
    }
  )
)

// Inventory Store
interface InventoryState {
  items: InventoryItem[]
  isLoading: boolean
  searchQuery: string
  selectedCategory: string | null
  sortBy: 'name' | 'quantity' | 'price' | 'updatedAt'
  sortOrder: 'asc' | 'desc'
  setItems: (items: InventoryItem[]) => void
  addItem: (item: InventoryItem) => void
  updateItem: (id: string, updates: Partial<InventoryItem>) => void
  removeItem: (id: string) => void
  setLoading: (loading: boolean) => void
  setSearchQuery: (query: string) => void
  setSelectedCategory: (category: string | null) => void
  setSortBy: (sortBy: 'name' | 'quantity' | 'price' | 'updatedAt') => void
  setSortOrder: (order: 'asc' | 'desc') => void
}

export const useInventoryStore = create<InventoryState>((set) => ({
  items: [],
  isLoading: true,
  searchQuery: '',
  selectedCategory: null,
  sortBy: 'updatedAt',
  sortOrder: 'desc',
  setItems: (items) => set({ items }),
  addItem: (item) => set((state) => ({ items: [item, ...state.items] })),
  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
}))

// Transaction Store
interface TransactionState {
  transactions: Transaction[]
  isLoading: boolean
  setTransactions: (transactions: Transaction[]) => void
  addTransaction: (transaction: Transaction) => void
  setLoading: (loading: boolean) => void
}

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  isLoading: true,
  setTransactions: (transactions) => set({ transactions }),
  addTransaction: (transaction) =>
    set((state) => ({ transactions: [transaction, ...state.transactions] })),
  setLoading: (isLoading) => set({ isLoading }),
}))

// AI Insights Store
interface InsightsState {
  insights: AIInsight[]
  isLoading: boolean
  setInsights: (insights: AIInsight[]) => void
  dismissInsight: (id: string) => void
  setLoading: (loading: boolean) => void
}

export const useInsightsStore = create<InsightsState>((set) => ({
  insights: [],
  isLoading: false,
  setInsights: (insights) => set({ insights }),
  dismissInsight: (id) =>
    set((state) => ({
      insights: state.insights.map((insight) =>
        insight.id === id ? { ...insight, dismissed: true } : insight
      ),
    })),
  setLoading: (isLoading) => set({ isLoading }),
}))

// UI Store
interface UIState {
  sidebarOpen: boolean
  theme: 'light' | 'dark'
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark') => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: 'dark',
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ui-storage',
    }
  )
)
