'use client'

import { useEffect, useState, useCallback } from 'react'
import { useOrgStore } from '@/lib/store'
import { db, isFirebaseConfigured } from '@/lib/firebase'
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp, orderBy, updateDoc, doc } from 'firebase/firestore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatCompactCurrency, formatPercentage } from '@/lib/currency'
import type { InventoryItem, Transaction, TransactionFormData } from '@/lib/types'
import {
  TrendingUp,
  IndianRupee,
  ShoppingCart,
  Package,
  Loader2,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Sparkles,
  Upload,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { toast } from 'sonner'
import { localDb } from '@/lib/localDb'

interface ProfitStats {
  totalRevenue: number
  totalCost: number
  grossProfit: number
  profitMargin: number
  totalTransactions: number
  avgOrderValue: number
}

export default function AnalyticsPage() {
  const { currentOrg } = useOrgStore()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [stats, setStats] = useState<ProfitStats | null>(null)
  const [dailyData, setDailyData] = useState<{ date: string; revenue: number; profit: number; cost: number }[]>([])
  const [topProducts, setTopProducts] = useState<{ name: string; revenue: number; profit: number; margin: number }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState<TransactionFormData>({
    itemId: '',
    type: 'sale',
    quantity: 1,
    unitPrice: 0,
    notes: '',
  })
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const [isImporting, setIsImporting] = useState(false)

  const handleImportSalesCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentOrg) return

    setIsImporting(true)
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[]

      let importedCount = 0
      for (const row of jsonData) {
        const sku = String(row['SKU'] || row['sku'] || row['Product SKU'] || '')
        const productName = String(row['Name'] || row['name'] || row['Product Name'] || '')
        const qty = Number(row['Quantity'] || row['quantity'] || row['Qty'] || row['Units'] || 0)
        const sellingPrice = Number(row['Selling Price'] || row['sellingPrice'] || row['Price'] || row['Sale Price'] || 0)
        
        // Parse date safely or fall back to today
        let saleDate = new Date()
        const rawDate = row['Date'] || row['date'] || row['Timestamp'] || row['timestamp']
        if (rawDate) {
          const parsed = new Date(String(rawDate))
          if (!isNaN(parsed.getTime())) {
            saleDate = parsed
          }
        }

        if (qty > 0 && (sku || productName)) {
          // Find matching item in catalog to get cost price & reduce inventory stock
          const matchedItem = items.find(
            (i) => 
              (sku && i.sku.toLowerCase() === sku.toLowerCase()) || 
              (productName && i.name.toLowerCase() === productName.toLowerCase())
          )

          const notes = String(row['Notes'] || row['notes'] || 'Bulk Sales Log CSV Import')

          if (!isFirebaseConfigured || !db) {
            // 1. Deduct stock quantity in local DB if item is registered
            if (matchedItem) {
              const newQty = Math.max(0, matchedItem.quantity - qty)
              localDb.updateItem(matchedItem.id, { quantity: newQty })
            }

            // 2. Add local sale transaction record
            localDb.addTransaction({
              orgId: currentOrg.id,
              itemId: matchedItem?.id || 'unregistered',
              type: 'sale',
              quantity: qty,
              unitPrice: sellingPrice,
              totalAmount: qty * sellingPrice,
              notes,
              createdBy: 'Sales_CSV_Importer',
              createdAt: saleDate,
            })
          } else {
            // 1. Deduct stock quantity in Firebase
            if (matchedItem) {
              const newQty = Math.max(0, matchedItem.quantity - qty)
              await updateDoc(doc(db, 'inventory', matchedItem.id), {
                quantity: newQty,
                updatedAt: serverTimestamp(),
              })
            }

            // 2. Add Cloud sale transaction record
            await addDoc(collection(db, 'transactions'), {
              orgId: currentOrg.id,
              itemId: matchedItem?.id || 'unregistered',
              type: 'sale',
              quantity: qty,
              unitPrice: sellingPrice,
              totalAmount: qty * sellingPrice,
              notes,
              createdAt: saleDate,
              createdBy: 'Sales_CSV_Importer',
            })
          }
          importedCount++
        }
      }

      // Re-trigger dynamic AI agent calculation for the entire store
      if (typeof window !== 'undefined') {
        const freshItems = !isFirebaseConfigured || !db 
          ? localDb.getItems(currentOrg.id) 
          : items
        const freshTransactions = !isFirebaseConfigured || !db 
          ? localDb.getTransactions(currentOrg.id) 
          : transactions

        const { orchestrateBusinessIntelligence } = await import('@/lib/ai-agents')
        await orchestrateBusinessIntelligence(freshItems, freshTransactions, currentOrg as any)
      }

      toast.success(`Successfully imported ${importedCount} sales transactions, updated active stock, and re-triggered AI agents!`)
      fetchData()
    } catch (error) {
      console.error('Error importing sales CSV:', error)
      toast.error('Failed to parse sales CSV file')
    } finally {
      setIsImporting(false)
      if (e.target) e.target.value = ''
    }
  }

  const fetchData = useCallback(async () => {
    if (!currentOrg) return

    setIsLoading(true)
    try {
      let fetchedItems: InventoryItem[] = []
      let fetchedTx: Transaction[] = []

      if (!isFirebaseConfigured || !db) {
        // LOCAL DATABASES FALLBACK
        fetchedItems = localDb.getItems(currentOrg.id)
        const rawTx = localDb.getTransactions(currentOrg.id)

        // Filter transactions by date range
        const daysAgo = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - daysAgo)

        fetchedTx = rawTx.filter(t => t.createdAt >= startDate)
      } else {
        // FIREBASE CLOUD FLOW
        const itemsQuery = query(collection(db, 'inventory'), where('orgId', '==', currentOrg.id))
        const itemsSnap = await getDocs(itemsQuery)
        fetchedItems = itemsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as InventoryItem[]

        const daysAgo = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - daysAgo)

        const txQuery = query(
          collection(db, 'transactions'),
          where('orgId', '==', currentOrg.id),
          where('createdAt', '>=', Timestamp.fromDate(startDate)),
          orderBy('createdAt', 'desc')
        )
        const txSnap = await getDocs(txQuery)
        fetchedTx = txSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        })) as Transaction[]
      }

      setItems(fetchedItems)
      setTransactions(fetchedTx)

      // Calculate stats
      const salesTx = fetchedTx.filter((t) => t.type === 'sale')
      const totalRevenue = salesTx.reduce((sum, t) => sum + t.totalAmount, 0)
      const totalCost = salesTx.reduce((sum, t) => {
        const item = fetchedItems.find((i) => i.id === t.itemId)
        return sum + (item?.costPrice || 0) * t.quantity
      }, 0)
      const grossProfit = totalRevenue - totalCost

      setStats({
        totalRevenue,
        totalCost,
        grossProfit,
        profitMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
        totalTransactions: salesTx.length,
        avgOrderValue: salesTx.length > 0 ? totalRevenue / salesTx.length : 0,
      })

      // Daily breakdown
      const daysAgo = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90
      const dailyMap = new Map<string, { revenue: number; cost: number }>()
      salesTx.forEach((tx) => {
        const date = tx.createdAt.toISOString().split('T')[0]
        const existing = dailyMap.get(date) || { revenue: 0, cost: 0 }
        const item = fetchedItems.find((i) => i.id === tx.itemId)
        existing.revenue += tx.totalAmount
        existing.cost += (item?.costPrice || 0) * tx.quantity
        dailyMap.set(date, existing)
      })

      // Fill in missing days
      const dailyArray = Array.from({ length: daysAgo }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - (daysAgo - 1 - i))
        const dateStr = date.toISOString().split('T')[0]
        const data = dailyMap.get(dateStr) || { revenue: 0, cost: 0 }
        return {
          date: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          revenue: data.revenue,
          cost: data.cost,
          profit: data.revenue - data.cost,
        }
      })
      setDailyData(dailyArray)

      // Top products by revenue
      const productStats = new Map<string, { revenue: number; cost: number; quantity: number }>()
      salesTx.forEach((tx) => {
        const item = fetchedItems.find((i) => i.id === tx.itemId)
        if (item) {
          const existing = productStats.get(item.id) || { revenue: 0, cost: 0, quantity: 0 }
          existing.revenue += tx.totalAmount
          existing.cost += item.costPrice * tx.quantity
          existing.quantity += tx.quantity
          productStats.set(item.id, existing)
        }
      })

      const topProds = Array.from(productStats.entries())
        .map(([itemId, data]) => {
          const item = fetchedItems.find((i) => i.id === itemId)
          return {
            name: item?.name || 'Unknown',
            revenue: data.revenue,
            profit: data.revenue - data.cost,
            margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0,
          }
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
      setTopProducts(topProds)
    } catch (error) {
      console.error('Error fetching analytics:', error)
      toast.error('Failed to load analytics data')
    } finally {
      setIsLoading(false)
    }
  }, [currentOrg, selectedPeriod])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleItemSelect = (itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    if (item) {
      setFormData({
        ...formData,
        itemId,
        unitPrice: formData.type === 'sale' ? item.sellingPrice : item.costPrice,
      })
    }
  }

  const handleAddTransaction = async () => {
    if (!currentOrg || !formData.itemId) return

    setIsSaving(true)
    try {
      const item = items.find((i) => i.id === formData.itemId)
      if (!item) throw new Error('Item not found')

      if (!isFirebaseConfigured || !db) {
        // Local transactional logging
        localDb.addTransaction({
          orgId: currentOrg.id,
          itemId: formData.itemId,
          type: formData.type,
          quantity: formData.quantity,
          unitPrice: formData.unitPrice,
          totalAmount: formData.quantity * formData.unitPrice,
          notes: formData.notes,
          createdBy: 'demo_owner_123',
        })
        toast.success('Transaction logged locally')
      } else {
        // Firebase Cloud Transactional logging
        await addDoc(collection(db, 'transactions'), {
          orgId: currentOrg.id,
          itemId: formData.itemId,
          type: formData.type,
          quantity: formData.quantity,
          unitPrice: formData.unitPrice,
          totalAmount: formData.quantity * formData.unitPrice,
          notes: formData.notes,
          createdBy: 'system',
          createdAt: serverTimestamp(),
        })
        toast.success('Transaction recorded successfully')
      }

      setIsAddDialogOpen(false)
      setFormData({ itemId: '', type: 'sale', quantity: 1, unitPrice: 0, notes: '' })
      fetchData()
    } catch (error) {
      console.error('Error adding transaction:', error)
      toast.error('Failed to record transaction')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
            {!isFirebaseConfigured && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20 text-[10px]">
                Offline Sandbox
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">Track your sales, purchasing, and profit margins</p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleImportSalesCSV}
              className="hidden"
              disabled={isImporting}
            />
            <Button variant="outline" asChild disabled={isImporting} className="bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 h-9 text-xs">
              <span>
                {isImporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Upload className="mr-2 h-4 w-4 text-primary" />
                )}
                Import Sales CSV
              </span>
            </Button>
          </label>
          <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as '7d' | '30d' | '90d')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Record Transaction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Transaction</DialogTitle>
                <DialogDescription>Add a new sales ticket or product purchase restock ledger entry</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Transaction Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) => setFormData({ ...formData, type: v as 'sale' | 'purchase' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sale">Sale (Reduces Stock)</SelectItem>
                      <SelectItem value="purchase">Purchase / Restock (Increases Stock)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Product</Label>
                  <Select value={formData.itemId} onValueChange={handleItemSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({item.sku}) - Qty: {item.quantity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                      min={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Price (₹)</Label>
                    <Input
                      type="number"
                      value={formData.unitPrice}
                      onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes / References</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. Invoice #2143, Cash memo"
                  />
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Total Transaction Value</p>
                  <p className="text-xl font-bold">{formatCurrency(formData.quantity * formData.unitPrice)}</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddTransaction} disabled={isSaving || !formData.itemId}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Commit Entry
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-500">{formatCompactCurrency(stats?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {selectedPeriod === '7d' ? 'Last 7 days' : selectedPeriod === '30d' ? 'Last 30 days' : 'Last 90 days'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{formatCompactCurrency(stats?.grossProfit || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {formatPercentage(stats?.profitMargin || 0, 1)} gross margin
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalTransactions || 0}</div>
            <p className="text-xs text-muted-foreground">Sales transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.avgOrderValue || 0)}</div>
            <p className="text-xs text-muted-foreground">Average size ticket</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue & Profit</TabsTrigger>
          <TabsTrigger value="products">Top Products</TabsTrigger>
          <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Revenue & Profit Trend Analysis
              </CardTitle>
              <CardDescription>Daily breakdown of gross sales vs cost-of-goods margins</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'currentColor', fontSize: 11 }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'currentColor', fontSize: 11 }}
                      tickLine={false}
                      tickFormatter={(v) => `₹${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#0284c7"
                      strokeWidth={3}
                      activeDot={{ r: 6 }}
                      name="Gross Revenue"
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="#22c55e"
                      strokeWidth={3}
                      name="Gross Profit"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Products</CardTitle>
              <CardDescription>Products ranked by revenue</CardDescription>
            </CardHeader>
            <CardContent>
              {topProducts.length > 0 ? (
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        type="number"
                        tick={{ fill: 'currentColor', fontSize: 11 }}
                        tickFormatter={(v) => `₹${v}`}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={130}
                        tick={{ fill: 'currentColor', fontSize: 10 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [formatCurrency(value), '']}
                      />
                      <Legend />
                      <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="profit" fill="#10b981" name="Profit" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mb-4" />
                  <p>No sales data yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions Ledger</CardTitle>
              <CardDescription>Latest sales and purchases</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.slice(0, 20).map((tx) => {
                      const item = items.find((i) => i.id === tx.itemId)
                      return (
                        <TableRow key={tx.id}>
                          <TableCell>
                            {tx.createdAt.toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </TableCell>
                          <TableCell className="font-medium">{item?.name || 'Unknown'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {tx.type === 'sale' ? (
                                <ArrowUpRight className="h-4 w-4 text-green-500" />
                              ) : (
                                <ArrowDownRight className="h-4 w-4 text-blue-500" />
                              )}
                              <span className="capitalize">{tx.type}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{tx.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(tx.unitPrice)}</TableCell>
                          <TableCell className="text-right font-medium">
                            <span className={tx.type === 'sale' ? 'text-green-500 font-semibold' : 'text-sky-600'}>
                              {tx.type === 'sale' ? '+' : '-'}
                              {formatCurrency(tx.totalAmount)}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mb-4" />
                  <p>No transactions recorded yet</p>
                  <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Record First Sale
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
