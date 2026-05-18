'use client'

import { useEffect, useState } from 'react'
import { useOrgStore } from '@/lib/store'
import { db, isFirebaseConfigured } from '@/lib/firebase'
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatCompactCurrency, formatPercentage } from '@/lib/currency'
import type { InventoryItem, Transaction, AIInsight } from '@/lib/types'
import {
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  IndianRupee,
  ArrowUpRight,
  Loader2,
  Sparkles,
  ArrowRight,
  MessageSquare,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { localDb } from '@/lib/localDb'
import Link from 'next/link'
import { orchestrateBusinessIntelligence } from '@/lib/ai-agents'

interface DashboardStats {
  totalRevenue: number
  totalProfit: number
  totalItems: number
  lowStockCount: number
  revenueChange: number
  profitChange: number
  healthScore: number
}

export default function DashboardPage() {
  const { currentOrg } = useOrgStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentTransactions, setRecentTransactions] = useState<(Transaction & { itemName: string })[]>([])
  const [salesData, setSalesData] = useState<{ date: string; sales: number; profit: number }[]>([])
  const [categoryData, setCategoryData] = useState<{ name: string; value: number }[]>([])
  const [activeInsight, setActiveInsight] = useState<AIInsight | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentOrg) return

    const fetchDashboardData = async () => {
      setIsLoading(true)
      try {
        let items: InventoryItem[] = []
        let transactions: Transaction[] = []
        let currentInsights: AIInsight[] = []

        if (!isFirebaseConfigured || !db) {
          // LOCAL FALLBACK DATA LOADING
          items = localDb.getItems(currentOrg.id)
          transactions = localDb.getTransactions(currentOrg.id)
          
          // Re-trigger our agent orchestrator to get the freshest insights
          currentInsights = await orchestrateBusinessIntelligence(items, transactions, currentOrg as any)
        } else {
          // FIREBASE CLOUD DATA LOADING
          const itemsQuery = query(
            collection(db, 'inventory'),
            where('orgId', '==', currentOrg.id)
          )
          const itemsSnap = await getDocs(itemsQuery)
          items = itemsSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as InventoryItem[]

          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
          
          const txQuery = query(
            collection(db, 'transactions'),
            where('orgId', '==', currentOrg.id),
            where('createdAt', '>=', Timestamp.fromDate(thirtyDaysAgo)),
            orderBy('createdAt', 'desc')
          )
          const txSnap = await getDocs(txQuery)
          transactions = txSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
          })) as Transaction[]

          const insightsQuery = query(
            collection(db, 'insights'),
            where('orgId', '==', currentOrg.id),
            where('dismissed', '==', false),
            orderBy('createdAt', 'desc'),
            limit(5)
          )
          const insightsSnap = await getDocs(insightsQuery)
          currentInsights = insightsSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
          })) as AIInsight[]
        }

        // Set the primary/highest severity active insight for the top banner
        if (currentInsights.length > 0) {
          const highSev = currentInsights.find(i => i.severity === 'high' || i.severity === 'medium')
          setActiveInsight(highSev || currentInsights[0])
        } else {
          setActiveInsight(null)
        }

        // Calculate stats
        const salesTx = transactions.filter((t) => t.type === 'sale')
        const totalRevenue = salesTx.reduce((sum, t) => sum + t.totalAmount, 0)
        const totalCost = salesTx.reduce((sum, t) => {
          const item = items.find((i) => i.id === t.itemId)
          return sum + (item?.costPrice || 0) * t.quantity
        }, 0)
        const totalProfit = totalRevenue - totalCost
        const lowStockCount = items.filter((i) => i.quantity <= i.minStockLevel).length
        const totalSKUs = items.length
        const healthScore = totalSKUs > 0 ? Math.round(((totalSKUs - lowStockCount) / totalSKUs) * 100) : 100

        // Previous period comparison (simulated)
        const revenueChange = totalRevenue > 0 ? 12.5 : 0
        const profitChange = totalProfit > 0 ? 8.2 : 0

        setStats({
          totalRevenue,
          totalProfit,
          totalItems: totalSKUs,
          lowStockCount,
          revenueChange,
          profitChange,
          healthScore,
        })

        // Recent transactions with item names
        const recentTx = transactions.slice(0, 5).map((tx) => {
          const item = items.find((i) => i.id === tx.itemId)
          return { ...tx, itemName: item?.name || 'Unknown Item' }
        })
        setRecentTransactions(recentTx)

        // Sales chart data (last 7 days)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = new Date()
          date.setDate(date.getDate() - (6 - i))
          return date.toISOString().split('T')[0]
        })

        const salesByDate = last7Days.map((date) => {
          const dayTx = salesTx.filter(
            (t) => {
              const txDate = t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt)
              return txDate.toISOString().split('T')[0] === date
            }
          )
          const daySales = dayTx.reduce((sum, t) => sum + t.totalAmount, 0)
          const dayCost = dayTx.reduce((sum, t) => {
            const item = items.find((i) => i.id === t.itemId)
            return sum + (item?.costPrice || 0) * t.quantity
          }, 0)
          return {
            date: new Date(date).toLocaleDateString('en-IN', { weekday: 'short' }),
            sales: daySales,
            profit: daySales - dayCost,
          }
        })
        setSalesData(salesByDate)

        // Category breakdown
        const categories = new Map<string, number>()
        items.forEach((item) => {
          const current = categories.get(item.category) || 0
          categories.set(item.category, current + item.quantity * item.costPrice)
        })
        const catData = Array.from(categories.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)
        setCategoryData(catData)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [currentOrg])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            {!isFirebaseConfigured && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20 text-[10px]">
                Offline Sandbox
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Overview of your business performance
          </p>
        </div>
      </div>

      {/* Daily AI Copilot Summary Banner */}
      {activeInsight && (
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 shadow-md border-primary/20 backdrop-blur-md">
          <div className="absolute right-0 top-0 -mr-6 -mt-6 h-28 w-28 rounded-full bg-primary/10 blur-xl"></div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0">
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Daily AI Co-pilot Alert</span>
                  <Badge variant={activeInsight.severity === 'high' ? 'destructive' : activeInsight.severity === 'medium' ? 'secondary' : 'outline'} className="text-[9px] h-4 py-0 px-1.5">
                    {activeInsight.severity} priority
                  </Badge>
                </div>
                <h3 className="text-sm font-bold text-foreground">{activeInsight.title}</h3>
                <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">{activeInsight.description}</p>
                <div className="text-[10px] text-muted-foreground/80 mt-1">
                  💡 <strong>Suggested Action:</strong> {activeInsight.recommendations[0]}
                </div>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <Button size="sm" className="bg-primary text-primary-foreground border-none text-[11px]" asChild>
                <Link href={activeInsight.type === 'dead_stock' ? '/dashboard/dead-stock' : '/dashboard/whatsapp'}>
                  {activeInsight.type === 'dead_stock' ? 'Clear Dead Stock' : 'Review on WhatsApp'}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-500">{formatCompactCurrency(stats?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {(stats?.revenueChange || 0) >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={(stats?.revenueChange || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>
                {formatPercentage(stats?.revenueChange || 0)}
              </span>
              {' '}from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{formatCompactCurrency(stats?.totalProfit || 0)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {(stats?.profitChange || 0) >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={(stats?.profitChange || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>
                {formatPercentage(stats?.profitChange || 0)}
              </span>
              {' '}from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Health</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold">{stats?.healthScore || 100}%</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                (stats?.healthScore || 100) >= 90 ? 'text-green-500' : (stats?.healthScore || 100) >= 70 ? 'text-amber-500' : 'text-red-500'
              }`}>
                {(stats?.healthScore || 100) >= 90 ? 'Excellent' : (stats?.healthScore || 100) >= 70 ? 'Optimal' : 'Attention Needed'}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  (stats?.healthScore || 100) >= 90 ? 'bg-green-500' : (stats?.healthScore || 100) >= 70 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${stats?.healthScore || 100}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground pt-0.5">
              {stats?.totalItems || 0} unique SKUs in catalog
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{stats?.lowStockCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Items below minimum level
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-7">
        {/* Sales Chart */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Sales Overview</CardTitle>
            <CardDescription>Daily sales and profit for the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), '']}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="hsl(var(--chart-1))"
                    fill="hsl(var(--chart-1))"
                    fillOpacity={0.2}
                    name="Sales"
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="hsl(var(--chart-2))"
                    fill="hsl(var(--chart-2))"
                    fillOpacity={0.2}
                    name="Profit"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Inventory by Category</CardTitle>
            <CardDescription>Stock value distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No inventory data
                </div>
              )}
            </div>
            {categoryData.length > 0 && (
              <div className="mt-4 space-y-2">
                {categoryData.map((cat, idx) => (
                  <div key={cat.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="text-muted-foreground">{cat.name}</span>
                    </div>
                    <span className="font-medium">{formatCompactCurrency(cat.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Latest sales and purchases</CardDescription>
        </CardHeader>
        <CardContent>
          {recentTransactions.length > 0 ? (
            <div className="space-y-4">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        tx.type === 'sale'
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-blue-500/10 text-blue-500'
                      }`}
                    >
                      <ArrowUpRight className={`h-5 w-5 ${tx.type !== 'sale' ? 'rotate-180' : ''}`} />
                    </div>
                    <div>
                      <p className="font-medium">{tx.itemName}</p>
                      <p className="text-sm text-muted-foreground">
                        {tx.quantity} units @ {formatCurrency(tx.unitPrice)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${tx.type === 'sale' ? 'text-green-500' : ''}`}>
                      {tx.type === 'sale' ? '+' : '-'}{formatCurrency(tx.totalAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No transactions yet. Start by adding inventory and recording sales.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
