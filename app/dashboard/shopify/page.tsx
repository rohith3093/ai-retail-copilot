'use client'

import { useState, useEffect, useCallback } from 'react'
import { useOrgStore } from '@/lib/store'
import { localDb } from '@/lib/localDb'
import { db, isFirebaseConfigured } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, deleteDoc, updateDoc, onSnapshot, orderBy, limit, serverTimestamp, setDoc } from 'firebase/firestore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/currency'
import { 
  ShoppingBag, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Database,
  Terminal,
  Zap,
  Globe,
  Settings,
  ArrowRight,
  TrendingUp,
  Package,
  Users
} from 'lucide-react'

export default function ShopifyDashboard() {
  const { currentOrg } = useOrgStore()
  const [shopUrl, setShopUrl] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [activeStore, setActiveStore] = useState<any | null>(null)
  
  // Stats
  const [productsCount, setProductsCount] = useState(0)
  const [ordersCount, setOrdersCount] = useState(0)
  const [customersCount, setCustomersCount] = useState(0)
  const [syncLogs, setSyncLogs] = useState<any[]>([])

  // Mock Simulator State
  const [simTopic, setSimTopic] = useState('orders/create')
  const [simSku, setSimSku] = useState('SKU-HEAD-WIRE')
  const [simQty, setSimQty] = useState('5')
  const [simPrice, setSimPrice] = useState('1500')
  const [simBuyerName, setSimBuyerName] = useState('John Doe')
  const [simIsFiring, setSimIsFiring] = useState(false)

  // Fetch store connection and statistics
  const fetchStoreData = useCallback(async () => {
    if (!currentOrg) return

    if (!isFirebaseConfigured || !db) {
      // Local Database fetch
      const stores = localDb.getStorage<any[]>('shopify_stores', [])
      const matched = stores.find((s: any) => s.organizationId === currentOrg.id)
      setActiveStore(matched || null)

      const prods = localDb.getStorage<any[]>('shopify_products', [])
      setProductsCount(prods.filter((p: any) => p.organizationId === currentOrg.id).length)

      const ords = localDb.getStorage<any[]>('shopify_orders', [])
      setOrdersCount(ords.filter((o: any) => o.organizationId === currentOrg.id).length)

      const custs = localDb.getStorage<any[]>('shopify_customers', [])
      setCustomersCount(custs.filter((c: any) => c.organizationId === currentOrg.id).length)

      const logs = localDb.getStorage<any[]>('webhook_events', [])
      const filteredLogs = logs
        .filter((l: any) => l.organizationId === currentOrg.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 15)
      setSyncLogs(filteredLogs)
    } else {
      // Cloud Firestore fetch
      try {
        const storeRef = collection(db, 'stores')
        const q = query(storeRef, where('organization_id', '==', currentOrg.id))
        const snap = await getDocs(q)
        if (!snap.empty) {
          const docData = snap.docs[0].data()
          setActiveStore({
            id: snap.docs[0].id,
            shopDomain: docData.shop_domain,
            syncStatus: docData.sync_status,
            connectedAt: docData.connected_at?.toDate(),
            lastSyncedAt: docData.last_synced_at?.toDate()
          })
        } else {
          setActiveStore(null)
        }

        // Count products
        const pQ = query(collection(db, 'shopify_products'), where('organizationId', '==', currentOrg.id))
        const pSnap = await getDocs(pQ)
        setProductsCount(pSnap.size)

        // Count orders
        const oQ = query(collection(db, 'shopify_orders'), where('organizationId', '==', currentOrg.id))
        const oSnap = await getDocs(oQ)
        setOrdersCount(oSnap.size)

        // Count customers
        const cQ = query(collection(db, 'shopify_customers'), where('organizationId', '==', currentOrg.id))
        const cSnap = await getDocs(cQ)
        setCustomersCount(cSnap.size)

        // Log events
        const logQ = query(collection(db, 'webhook_events'), where('organizationId', '==', currentOrg.id), orderBy('createdAt', 'desc'), limit(15))
        const logSnap = await getDocs(logQ)
        setSyncLogs(logSnap.docs.map(doc => ({
          id: doc.id,
          topic: doc.data().topic,
          processed: doc.data().processed,
          createdAt: doc.data().createdAt?.toDate() || new Date()
        })))
      } catch (err) {
        console.error('Firebase read error in Shopify dashboard:', err)
      }
    }
  }, [currentOrg])

  // Real-time listener for logs
  useEffect(() => {
    fetchStoreData()

    if (isFirebaseConfigured && db && currentOrg) {
      const q = query(
        collection(db, 'webhook_events'),
        where('organizationId', '==', currentOrg.id),
        orderBy('createdAt', 'desc'),
        limit(15)
      )
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setSyncLogs(snapshot.docs.map(doc => ({
          id: doc.id,
          topic: doc.data().topic,
          processed: doc.data().processed,
          createdAt: doc.data().createdAt?.toDate() || new Date()
        })))
      }, (err) => console.error(err))
      return () => unsubscribe()
    }
  }, [currentOrg, fetchStoreData])



  // Handle disconnect
  const handleDisconnect = async () => {
    if (!currentOrg || !activeStore) return
    if (!confirm('Are you sure you want to disconnect your Shopify store? This will revoke access.')) return

    if (!isFirebaseConfigured || !db) {
      const stores = localDb.getStorage<any[]>('shopify_stores', [])
      const filtered = stores.filter((s: any) => s.organizationId !== currentOrg.id)
      localDb.setStorage('shopify_stores', filtered)
      
      // Clean up integration logs/syncs
      localDb.setStorage('shopify_products', localDb.getStorage<any[]>('shopify_products', []).filter((p: any) => p.organizationId !== currentOrg.id))
      localDb.setStorage('shopify_orders', localDb.getStorage<any[]>('shopify_orders', []).filter((o: any) => o.organizationId !== currentOrg.id))
      localDb.setStorage('shopify_customers', localDb.getStorage<any[]>('shopify_customers', []).filter((c: any) => c.organizationId !== currentOrg.id))

      setActiveStore(null)
      setProductsCount(0)
      setOrdersCount(0)
      setCustomersCount(0)
    } else {
      try {
        await deleteDoc(doc(db, 'stores', activeStore.id))
        setActiveStore(null)
        setProductsCount(0)
        setOrdersCount(0)
        setCustomersCount(0)
      } catch (err) {
        console.error('Failed to delete store link:', err)
      }
    }
  }

  // Generate sandbox test data
  const handleGenerateSandboxData = async () => {
    if (!currentOrg) return
    setIsSyncing(true)

    // Wait a brief period to simulate connection
    setTimeout(async () => {
      if (!isFirebaseConfigured || !db) {
        // Set mock store connection
        const stores = localDb.getStorage<any[]>('shopify_stores', [])
        const clean = stores.filter((s: any) => s.organizationId !== currentOrg.id)
        clean.push({
          id: `store_${Date.now()}`,
          organizationId: currentOrg.id,
          shopDomain: 'sharma-sweets-demo.myshopify.com',
          accessToken: 'shpat_mock_demo_token_123',
          connectedAt: new Date(),
          syncStatus: 'success',
          lastSyncedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        })
        localDb.setStorage('shopify_stores', clean)
      } else {
        const storeId = `${currentOrg.id}_shopify`
        await setDoc(doc(db, 'stores', storeId), {
          id: storeId,
          organization_id: currentOrg.id,
          shop_domain: 'sharma-sweets-demo.myshopify.com',
          access_token: 'shpat_mock_demo_token_123',
          connected_at: serverTimestamp(),
          sync_status: 'success',
          last_synced_at: serverTimestamp()
        })
      }

      // Execute Sync onboarding imports
      const { ShopifySyncService } = await import('../../../services/shopify/sync.service')
      await ShopifySyncService.syncProducts(currentOrg.id, `store_demo`, 'shpat_mock_demo', 'sharma-sweets-demo.myshopify.com')
      await ShopifySyncService.syncOrders(currentOrg.id, `store_demo`, 'shpat_mock_demo', 'sharma-sweets-demo.myshopify.com')
      await ShopifySyncService.syncCustomers(currentOrg.id, `store_demo`, 'shpat_mock_demo', 'sharma-sweets-demo.myshopify.com')
      
      await fetchStoreData()
      setIsSyncing(false)
    }, 1500)
  }

  // Force Manual Re-sync
  const handleForceSync = async () => {
    if (!currentOrg || !activeStore) return
    setIsSyncing(true)

    try {
      const { ShopifySyncService } = await import('../../../services/shopify/sync.service')
      
      let token = 'shpat_mock_demo'
      if (!isFirebaseConfigured || !db) {
        const stores = localDb.getStorage<any[]>('shopify_stores', [])
        const match = stores.find((s: any) => s.organizationId === currentOrg.id)
        if (match) {
          const { ShopifyAuthService } = await import('../../../services/shopify/auth.service')
          token = ShopifyAuthService.decryptToken(match.accessToken)
        }
      } else {
        const storeRef = doc(db, 'stores', activeStore.id)
        const snap = await getDocs(query(collection(db, 'stores'), where('organization_id', '==', currentOrg.id)))
        if (!snap.empty) {
          const { ShopifyAuthService } = await import('../../../services/shopify/auth.service')
          token = ShopifyAuthService.decryptToken(snap.docs[0].data().access_token)
        }
      }

      await ShopifySyncService.syncProducts(currentOrg.id, activeStore.id, token, activeStore.shopDomain)
      await ShopifySyncService.syncOrders(currentOrg.id, activeStore.id, token, activeStore.shopDomain)
      await ShopifySyncService.syncCustomers(currentOrg.id, activeStore.id, token, activeStore.shopDomain)
      
      // Update last sync stamp
      if (!isFirebaseConfigured || !db) {
        const stores = localDb.getStorage<any[]>('shopify_stores', [])
        const idx = stores.findIndex((s: any) => s.organizationId === currentOrg.id)
        if (idx > -1) {
          stores[idx].lastSyncedAt = new Date()
          localDb.setStorage('shopify_stores', stores)
        }
      } else {
        await updateDoc(doc(db, 'stores', activeStore.id), {
          last_synced_at: serverTimestamp()
        })
      }

      await fetchStoreData()
    } catch (e) {
      console.error(e)
    } finally {
      setIsSyncing(false)
    }
  }

  // Firing Webhook from simulated dropdown uploader
  const handleFireSimulatedWebhook = async () => {
    if (!currentOrg || !activeStore) {
      alert('Please connect or generate mock store before firing webhooks.')
      return
    }
    setSimIsFiring(true)

    try {
      const { MockShopifyProvider } = await import('../../../services/shopify/mock.provider')
      let detailParams: any = {}
      
      if (simTopic === 'orders/create') {
        detailParams = {
          sku: simSku,
          price: Number(simPrice),
          quantity: Number(simQty),
          totalPrice: Number(simPrice) * Number(simQty),
          customerName: simBuyerName,
          customerEmail: `${simBuyerName.toLowerCase().replace(/\s+/g, '.')}@example.com`
        }
      } else if (simTopic === 'products/update' || simTopic === 'products/create') {
        detailParams = {
          sku: simSku,
          price: Number(simPrice),
          quantity: Number(simQty)
        }
      } else if (simTopic === 'inventory_levels/update') {
        detailParams = {
          quantity: Number(simQty)
        }
      }

      const payload = MockShopifyProvider.generateMockWebhookPayload(simTopic, detailParams)

      // Post to the webhook ingestion API route
      const response = await fetch('/api/shopify/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-shopify-topic': simTopic,
          'x-shopify-shop-domain': activeStore.shopDomain,
          'x-shopify-hmac-sha256': 'mock_hmac_secret_hash_code_bypass'
        },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        setTimeout(async () => {
          await fetchStoreData()
        }, 1200)
      } else {
        alert('Simulated webhook returned status: ' + response.status)
      }

    } catch (err) {
      console.error('Failed to trigger mock webhook:', err)
    } finally {
      setSimIsFiring(false)
    }
  }

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent flex items-center gap-2">
            <ShoppingBag className="h-8 w-8 text-emerald-500" />
            Shopify Integration
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Securely authorize, sync products, track store inventory, and trigger real-time AI decision workflows.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeStore ? (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleForceSync}
                disabled={isSyncing}
                className="flex items-center gap-1.5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleDisconnect}
                className="flex items-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateSandboxData}
              disabled={isSyncing}
              className="flex items-center gap-1.5 border-teal-500/30 text-teal-400 hover:bg-teal-500/10"
            >
              <Database className="h-4 w-4" />
              Generate Fake Shopify Data
            </Button>
          )}
        </div>
      </div>

      {/* Connection Panel */}
      {!activeStore ? (
        <Card className="border-emerald-500/10 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 h-40 w-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Globe className="h-5 w-5 text-emerald-400" />
              Connect Shopify Store
            </CardTitle>
            <CardDescription>
              Provide your Shop URL (e.g. your-store-name.myshopify.com) to initialize secure OAuth permissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            <form action="/api/shopify/auth" method="GET" className="flex flex-col sm:flex-row gap-3 max-w-xl">
              <input type="hidden" name="orgId" value={currentOrg?.id || ''} />
              <Input
                type="text"
                name="shop"
                placeholder="your-store-name.myshopify.com"
                value={shopUrl}
                onChange={(e) => setShopUrl(e.target.value)}
                required
                className="flex-1 border-emerald-500/20 bg-background/50 focus-visible:ring-emerald-500/50"
              />
              <Button 
                type="submit" 
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium flex items-center gap-1 px-6"
              >
                Connect Store
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Store info */}
          <Card className="border-emerald-500/10 bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardDescription>CONNECTED STORE</CardDescription>
              <CardTitle className="text-lg flex items-center gap-2 truncate">
                <Globe className="h-5 w-5 text-emerald-400 shrink-0" />
                {activeStore.shopDomain}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Authorization status</span>
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/10 border-0 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Authorized
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Sync status</span>
                <Badge 
                  variant="outline" 
                  className={
                    activeStore.syncStatus === 'success' 
                      ? 'border-emerald-500/20 text-emerald-400' 
                      : 'border-yellow-500/20 text-yellow-400'
                  }
                >
                  {activeStore.syncStatus === 'success' ? 'Success' : 'Syncing'}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last synchronized</span>
                <span className="font-mono text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {activeStore.lastSyncedAt 
                    ? new Date(activeStore.lastSyncedAt).toLocaleTimeString() 
                    : 'Awaiting sync...'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Sync Stats */}
          <div className="grid grid-cols-3 md:grid-cols-1 gap-4 md:col-span-2">
            <div className="grid grid-cols-3 gap-4 h-full">
              
              <Card className="border-emerald-500/10 bg-card/60 backdrop-blur-md">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs text-muted-foreground font-medium uppercase">Products Synced</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold flex items-center gap-2">
                    <Package className="h-5 w-5 text-emerald-400" />
                    {productsCount}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-emerald-500/10 bg-card/60 backdrop-blur-md">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs text-muted-foreground font-medium uppercase">Orders Synced</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                    {ordersCount}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-emerald-500/10 bg-card/60 backdrop-blur-md">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs text-muted-foreground font-medium uppercase">Customers Synced</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-emerald-400" />
                    {customersCount}
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      )}

      {/* Simulator and Log Terminal Section */}
      {activeStore && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Webhook Simulator Form */}
          <Card className="border-emerald-500/10 bg-card/60 backdrop-blur-md relative">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-400" />
                Shopify Webhook Simulator
              </CardTitle>
              <CardDescription>
                Simulate standard Shopify JSON webhook payloads to verify system triggers, inventory decs, and AI updates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground font-semibold">WEBHOOK TOPIC</label>
                  <Select value={simTopic} onValueChange={setSimTopic}>
                    <SelectTrigger className="border-emerald-500/20 bg-background/50">
                      <SelectValue placeholder="Select topic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="orders/create">orders/create (Log Sale)</SelectItem>
                      <SelectItem value="products/update">products/update (Update SKU)</SelectItem>
                      <SelectItem value="inventory_levels/update">inventory_levels/update</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground font-semibold">SKU / ITEM CODE</label>
                  <Input 
                    type="text" 
                    value={simSku} 
                    onChange={(e) => setSimSku(e.target.value)} 
                    className="border-emerald-500/20 bg-background/50" 
                  />
                </div>
              </div>

              {simTopic === 'orders/create' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground font-semibold">BUYER NAME</label>
                    <Input 
                      type="text" 
                      value={simBuyerName} 
                      onChange={(e) => setSimBuyerName(e.target.value)} 
                      className="border-emerald-500/20 bg-background/50" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground font-semibold">UNIT PRICE (INR)</label>
                    <Input 
                      type="number" 
                      value={simPrice} 
                      onChange={(e) => setSimPrice(e.target.value)} 
                      className="border-emerald-500/20 bg-background/50" 
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground font-semibold">
                    {simTopic === 'orders/create' ? 'SOLD QUANTITY' : 'INVENTORY QUANTITY'}
                  </label>
                  <Input 
                    type="number" 
                    value={simQty} 
                    onChange={(e) => setSimQty(e.target.value)} 
                    className="border-emerald-500/20 bg-background/50" 
                  />
                </div>
                
                <div className="flex items-end justify-end h-full">
                  <Button
                    onClick={handleFireSimulatedWebhook}
                    disabled={simIsFiring}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium flex items-center justify-center gap-1.5"
                  >
                    <Zap className="h-4 w-4" />
                    {simIsFiring ? 'Firing webhook...' : 'Fire Webhook'}
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Webhook Activity Terminal Logs */}
          <Card className="border-emerald-500/10 bg-zinc-950 text-emerald-400 font-mono relative overflow-hidden flex flex-col h-[350px]">
            <CardHeader className="border-b border-emerald-950 bg-black/40 py-3">
              <CardTitle className="text-xs flex items-center justify-between font-mono tracking-wider">
                <span className="flex items-center gap-1.5 text-emerald-300">
                  <Terminal className="h-4 w-4" />
                  LIVE WEBHOOK LOG TERMINAL
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex-1 overflow-y-auto space-y-2 text-xs scrollbar-thin scrollbar-thumb-emerald-950">
              
              {syncLogs.length === 0 ? (
                <div className="text-zinc-600 text-center py-12">
                  // Awaiting webhook signals...
                  <br />
                  // Fire simulation events on left to populate.
                </div>
              ) : (
                syncLogs.map((log, idx) => (
                  <div key={log.id || idx} className="border-b border-emerald-950/20 pb-2">
                    <div className="flex items-center justify-between text-zinc-500 text-[10px]">
                      <span>EVENT: {log.id?.substring(0, 10)}...</span>
                      <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge variant="outline" className="h-5 text-[9px] font-mono border-emerald-950 text-emerald-300 uppercase px-1">
                        {log.topic}
                      </Badge>
                      <span className="text-emerald-400">
                        {log.processed ? '✓ processed successfully' : '⚙ processing...'}
                      </span>
                    </div>
                  </div>
                ))
              )}

            </CardContent>
          </Card>

        </div>
      )}

    </div>
  )
}
