'use client'

import { useEffect, useState, useCallback } from 'react'
import { useOrgStore, useInsightsStore } from '@/lib/store'
import { db, isFirebaseConfigured } from '@/lib/firebase'
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { analyzeDeadStock, generateInventoryInsights } from '@/lib/ai'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { formatCurrency, formatCompactCurrency } from '@/lib/currency'
import type { InventoryItem, Transaction, AIInsight } from '@/lib/types'
import {
  AlertTriangle,
  Loader2,
  Sparkles,
  RefreshCw,
  TrendingDown,
  Package,
  Clock,
  IndianRupee,
  CheckCircle2,
  XCircle,
  Lightbulb,
} from 'lucide-react'
import { toast } from 'sonner'
import { localDb } from '@/lib/localDb'

interface DeadStockItem extends InventoryItem {
  daysSinceLastSale: number
  totalValue: number
}

export default function DeadStockPage() {
  const { currentOrg } = useOrgStore()
  const { insights, setInsights, dismissInsight, isLoading: insightsLoading, setLoading: setInsightsLoading } = useInsightsStore()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [deadStockItems, setDeadStockItems] = useState<DeadStockItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [deadStockDays, setDeadStockDays] = useState(45) // standard FMCG window is shorter

  const fetchData = useCallback(async () => {
    if (!currentOrg) return

    setIsLoading(true)
    try {
      let fetchedItems: InventoryItem[] = []
      let fetchedTx: Transaction[] = []

      if (!isFirebaseConfigured || !db) {
        // LOCAL FALLBACK DATA LOADING
        fetchedItems = localDb.getItems(currentOrg.id)
        fetchedTx = localDb.getTransactions(currentOrg.id).filter((t) => t.type === 'sale')
        
        // Load insights from local storage
        const localInsights = localDb.getInsights(currentOrg.id)
        setInsights(localInsights)
      } else {
        // FIREBASE CLOUD FLOW
        const itemsQuery = query(collection(db, 'inventory'), where('orgId', '==', currentOrg.id))
        const itemsSnap = await getDocs(itemsQuery)
        fetchedItems = itemsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
          lastRestocked: doc.data().lastRestocked?.toDate() || null,
        })) as InventoryItem[]

        const txQuery = query(
          collection(db, 'transactions'),
          where('orgId', '==', currentOrg.id),
          where('type', '==', 'sale')
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

      // Calculate dead stock
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - deadStockDays)

      const itemLastSale = new Map<string, Date>()
      fetchedTx.forEach((tx) => {
        const existing = itemLastSale.get(tx.itemId)
        const txDate = tx.createdAt instanceof Date ? tx.createdAt : new Date(tx.createdAt)
        if (!existing || txDate > existing) {
          itemLastSale.set(tx.itemId, txDate)
        }
      })

      const deadStock = fetchedItems
        .filter((item) => {
          if (item.quantity === 0) return false
          const lastSale = itemLastSale.get(item.id)
          if (!lastSale) return true // Never sold
          return lastSale < cutoffDate
        })
        .map((item) => {
          const lastSale = itemLastSale.get(item.id)
          const daysSince = lastSale
            ? Math.floor((Date.now() - lastSale.getTime()) / (1000 * 60 * 60 * 24))
            : 999
          return {
            ...item,
            daysSinceLastSale: daysSince,
            totalValue: item.quantity * item.costPrice,
          }
        })
        .sort((a, b) => b.totalValue - a.totalValue)

      setDeadStockItems(deadStock)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load inventory data')
    } finally {
      setIsLoading(false)
    }
  }, [currentOrg, deadStockDays, setInsights])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const runAIAnalysis = async () => {
    if (items.length === 0) {
      toast.error('No inventory items to analyze')
      return
    }

    setIsAnalyzing(true)
    setInsightsLoading(true)
    try {
      const [deadStockInsights, inventoryInsights] = await Promise.all([
        analyzeDeadStock(items, transactions, deadStockDays),
        generateInventoryInsights(items, transactions),
      ])

      const all = [...deadStockInsights, ...inventoryInsights]
      setInsights(all)
      
      if (!isFirebaseConfigured || !db) {
        localDb.saveInsights(currentOrg!.id, all)
      }
      
      toast.success('AI Multi-Agent audit completed!')
    } catch (error) {
      console.error('Error running AI analysis:', error)
      toast.error('Failed to run AI analysis')
    } finally {
      setIsAnalyzing(false)
      setInsightsLoading(false)
    }
  }

  const handleDismiss = (id: string) => {
    dismissInsight(id)
    if (!isFirebaseConfigured || !db) {
      const updated = insights.map((i) => i.id === id ? { ...i, dismissed: true } : i)
      localDb.saveInsights(currentOrg!.id, updated)
    }
    toast.success('Insight dismissed')
  }

  const totalDeadStockValue = deadStockItems.reduce((sum, item) => sum + item.totalValue, 0)
  const totalInventoryValue = items.reduce((sum, item) => sum + item.quantity * item.costPrice, 0)
  const deadStockPercentage = totalInventoryValue > 0 ? (totalDeadStockValue / totalInventoryValue) * 100 : 0

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500/10 text-red-500 border-red-500/20'
      case 'medium':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      default:
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    }
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'dead_stock':
        return AlertTriangle
      case 'reorder':
        return Package
      case 'pricing':
        return IndianRupee
      default:
        return Lightbulb
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
            <h1 className="text-2xl font-bold tracking-tight">Dead Stock Analysis</h1>
            {!isFirebaseConfigured && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20 text-[10px]">
                Offline Sandbox
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Identify slow-moving inventory and get AI-powered recommendations
          </p>
        </div>
        <Button onClick={runAIAnalysis} disabled={isAnalyzing || items.length === 0}>
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Audit...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4 animate-bounce" />
              Run AI Audit
            </>
          )}
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dead Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deadStockItems.length}</div>
            <p className="text-xs text-muted-foreground">
              No sales in {deadStockDays}+ days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dead Stock Value</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {formatCompactCurrency(totalDeadStockValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Capital tied up in slow inventory
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dead Stock Ratio</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deadStockPercentage.toFixed(1)}%</div>
            <Progress value={deadStockPercentage} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Insights</CardTitle>
            <Sparkles className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insights.filter((i) => !i.dismissed).length}
            </div>
            <p className="text-xs text-muted-foreground">Active recommendations</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      {insights.filter((i) => !i.dismissed).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Insights & Recommendations
            </CardTitle>
            <CardDescription>
              Actionable recommendations based on your inventory analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {insights
                .filter((insight) => !insight.dismissed)
                .map((insight, index) => {
                  const Icon = getInsightIcon(insight.type)
                  return (
                    <AccordionItem key={insight.id || index} value={`item-${index}`}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 text-left">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-lg border ${getSeverityColor(
                              insight.severity
                            )}`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{insight.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge
                                variant="outline"
                                className={getSeverityColor(insight.severity)}
                              >
                                {insight.severity} priority
                              </Badge>
                              <span className="text-xs text-muted-foreground capitalize">
                                {insight.type.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          <p className="text-muted-foreground">{insight.description}</p>
                          
                          {insight.recommendations && insight.recommendations.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">Recommended Actions:</h4>
                              <ul className="space-y-2">
                                {insight.recommendations.map((rec, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                    <span className="text-sm">{rec}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDismiss(insight.id)}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Dismiss
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Dead Stock Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Dead Stock Items</CardTitle>
              <CardDescription>
                Products with no sales in the last {deadStockDays} days
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {deadStockItems.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead className="text-right">Days Since Sale</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deadStockItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.costPrice)}</TableCell>
                      <TableCell className="text-right font-medium text-red-500">
                        {formatCurrency(item.totalValue)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span
                            className={
                              item.daysSinceLastSale > 60
                                ? 'text-red-500 font-semibold'
                                : item.daysSinceLastSale > 45
                                ? 'text-amber-500 font-semibold'
                                : ''
                            }
                          >
                            {item.daysSinceLastSale === 999 ? 'Never' : `${item.daysSinceLastSale}d`}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-medium">No Dead Stock Found</h3>
              <p className="text-muted-foreground mt-1">
                Great job! All your inventory items have sold within the last {deadStockDays} days.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
