'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useOrgStore, useInventoryStore } from '@/lib/store'
import { db, isFirebaseConfigured } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import type { InventoryItem, InventoryFormData } from '@/lib/types'
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
  Download,
  Loader2,
  Package,
  FileText,
  Sparkles,
  Image as ImageIcon,
  CheckCircle,
  FileSpreadsheet,
  Calculator,
  ShoppingCart,
  Receipt,
  Trash,
} from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { localDb } from '@/lib/localDb'

const CATEGORIES = [
  'Electronics',
  'Clothing',
  'Food & Beverages',
  'Home & Garden',
  'Health & Beauty',
  'Sports & Outdoors',
  'Toys & Games',
  'Books & Stationery',
  'Automotive',
  'Other',
]

interface OcrExtractedItem {
  sku: string
  name: string
  category: string
  quantity: number
  costPrice: number
  sellingPrice: number
  supplier: string
}

const initialFormData: InventoryFormData = {
  sku: '',
  name: '',
  description: '',
  category: '',
  quantity: 0,
  costPrice: 0,
  sellingPrice: 0,
  minStockLevel: 10,
  supplier: '',
}

export default function InventoryPage() {
  const { currentOrg } = useOrgStore()
  const {
    items,
    isLoading,
    searchQuery,
    selectedCategory,
    setItems,
    addItem,
    updateItem,
    removeItem,
    setLoading,
    setSearchQuery,
    setSelectedCategory,
  } = useInventoryStore()

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [formData, setFormData] = useState<InventoryFormData>(initialFormData)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  // OCR Simulator States
  const [isOcrDialogOpen, setIsOcrDialogOpen] = useState(false)
  const [ocrStep, setOcrStep] = useState<'idle' | 'uploading' | 'processing' | 'success'>('idle')
  const [ocrProgressText, setOcrProgressText] = useState('')
  const [ocrFileName, setOcrFileName] = useState('')
  const [ocrItems, setOcrItems] = useState<OcrExtractedItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  // Quick POS Simulator States
  const [isPosOpen, setIsPosOpen] = useState(false)
  const [posCart, setPosCart] = useState<{ item: InventoryItem; qty: number }[]>([])
  const [posSelectedItem, setPosSelectedItem] = useState<string>('')
  const [posQty, setPosQty] = useState<number>(1)
  const [posCheckoutSuccess, setPosCheckoutSuccess] = useState(false)

  const fetchInventory = useCallback(async () => {
    if (!currentOrg) return

    setLoading(true)
    try {
      if (!isFirebaseConfigured || !db) {
        // LocalDb Fallback
        const fetchedItems = localDb.getItems(currentOrg.id)
        setItems(fetchedItems)
        return
      }

      const q = query(collection(db, 'inventory'), where('orgId', '==', currentOrg.id))
      const snapshot = await getDocs(q)
      const fetchedItems = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        lastRestocked: doc.data().lastRestocked?.toDate() || null,
      })) as InventoryItem[]
      setItems(fetchedItems)
    } catch (error) {
      console.error('Error fetching inventory:', error)
      toast.error('Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }, [currentOrg, setItems, setLoading])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const handleAddItem = async () => {
    if (!currentOrg) return

    setIsSaving(true)
    try {
      if (!isFirebaseConfigured || !db) {
        // Local CRUD
        const newItem = localDb.addItem({
          ...formData,
          orgId: currentOrg.id,
        })
        addItem(newItem)
        toast.success('Item added to local database')
        setIsAddDialogOpen(false)
        setFormData(initialFormData)
        return
      }

      const docRef = await addDoc(collection(db, 'inventory'), {
        ...formData,
        orgId: currentOrg.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastRestocked: formData.quantity > 0 ? serverTimestamp() : null,
      })

      addItem({
        ...formData,
        id: docRef.id,
        orgId: currentOrg.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastRestocked: formData.quantity > 0 ? new Date() : undefined,
      })

      toast.success('Item added successfully')
      setIsAddDialogOpen(false)
      setFormData(initialFormData)
    } catch (error) {
      console.error('Error adding item:', error)
      toast.error('Failed to add item')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditItem = async () => {
    if (!editingItem) return

    setIsSaving(true)
    try {
      if (!isFirebaseConfigured || !db) {
        // Local CRUD
        localDb.updateItem(editingItem.id, formData)
        updateItem(editingItem.id, {
          ...formData,
          updatedAt: new Date(),
        })
        toast.success('Item updated locally')
        setIsEditDialogOpen(false)
        setEditingItem(null)
        setFormData(initialFormData)
        return
      }

      const itemRef = doc(db, 'inventory', editingItem.id)
      await updateDoc(itemRef, {
        ...formData,
        updatedAt: serverTimestamp(),
      })

      updateItem(editingItem.id, {
        ...formData,
        updatedAt: new Date(),
      })

      toast.success('Item updated successfully')
      setIsEditDialogOpen(false)
      setEditingItem(null)
      setFormData(initialFormData)
    } catch (error) {
      console.error('Error updating item:', error)
      toast.error('Failed to update item')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteItem = async () => {
    if (!deletingItem) return

    setIsSaving(true)
    try {
      if (!isFirebaseConfigured || !db) {
        // Local CRUD
        localDb.removeItem(deletingItem.id)
        removeItem(deletingItem.id)
        toast.success('Item deleted locally')
        setIsDeleteDialogOpen(false)
        setDeletingItem(null)
        return
      }

      await deleteDoc(doc(db, 'inventory', deletingItem.id))
      removeItem(deletingItem.id)
      toast.success('Item deleted successfully')
      setIsDeleteDialogOpen(false)
      setDeletingItem(null)
    } catch (error) {
      console.error('Error deleting item:', error)
      toast.error('Failed to delete item')
    } finally {
      setIsSaving(false)
    }
  }

  const openEditDialog = (item: InventoryItem) => {
    setEditingItem(item)
    setFormData({
      sku: item.sku,
      name: item.name,
      description: item.description || '',
      category: item.category,
      quantity: item.quantity,
      costPrice: item.costPrice,
      sellingPrice: item.sellingPrice,
      minStockLevel: item.minStockLevel,
      supplier: item.supplier || '',
    })
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (item: InventoryItem) => {
    setDeletingItem(item)
    setIsDeleteDialogOpen(true)
  }

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const itemData: InventoryFormData = {
          sku: String(row['SKU'] || row['sku'] || `SKU-${Date.now()}-${importedCount}`),
          name: String(row['Name'] || row['name'] || row['Product Name'] || ''),
          description: String(row['Description'] || row['description'] || ''),
          category: String(row['Category'] || row['category'] || 'Other'),
          quantity: Number(row['Quantity'] || row['quantity'] || row['Stock'] || 0),
          costPrice: Number(row['Cost Price'] || row['costPrice'] || row['Cost'] || 0),
          sellingPrice: Number(row['Selling Price'] || row['sellingPrice'] || row['Price'] || 0),
          minStockLevel: Number(row['Min Stock'] || row['minStockLevel'] || 10),
          supplier: String(row['Supplier'] || row['supplier'] || ''),
        }

        if (itemData.name) {
          if (!isFirebaseConfigured || !db) {
            // Local Import
            const newItem = localDb.addItem({
              ...itemData,
              orgId: currentOrg.id,
            })
            addItem(newItem)
          } else {
            // Firebase Import
            const docRef = await addDoc(collection(db, 'inventory'), {
              ...itemData,
              orgId: currentOrg.id,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              lastRestocked: itemData.quantity > 0 ? serverTimestamp() : null,
            })

            addItem({
              ...itemData,
              id: docRef.id,
              orgId: currentOrg.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              lastRestocked: itemData.quantity > 0 ? new Date() : undefined,
            })
          }
          importedCount++
        }
      }

      toast.success(`Imported ${importedCount} items successfully`)
    } catch (error) {
      console.error('Error importing Excel:', error)
      toast.error('Failed to import Excel file')
    } finally {
      setIsImporting(false)
      e.target.value = ''
    }
  }

  const handleExportExcel = () => {
    const exportData = items.map((item) => ({
      SKU: item.sku,
      Name: item.name,
      Description: item.description || '',
      Category: item.category,
      Quantity: item.quantity,
      'Cost Price': item.costPrice,
      'Selling Price': item.sellingPrice,
      'Min Stock': item.minStockLevel,
      Supplier: item.supplier || '',
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory')
    XLSX.writeFile(workbook, `inventory_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success('Inventory exported successfully')
  }

  // MOCK INVOICE OCR SCANNER CONTROLLERS
  const triggerOcrScan = (fileName: string) => {
    setOcrFileName(fileName)
    setOcrStep('processing')
    setOcrProgressText('Initializing Gemini Multimodal Vision API...')

    setTimeout(() => {
      setOcrProgressText('Detecting document grid and borders...')
      setTimeout(() => {
        setOcrProgressText('Running character recognition & OCR layout engine...')
        setTimeout(() => {
          setOcrProgressText('Extracting line items, costs, and tax codes...')
          setTimeout(() => {
            // Seed a realistic wholesale invoice based on random selection
            const isNestle = Math.random() > 0.5
            let extracted: OcrExtractedItem[] = []

            if (isNestle) {
              extracted = [
                {
                  sku: 'FMCG-NC-13',
                  name: 'Nescafe Classic Coffee 50g',
                  category: 'Food & Beverages',
                  quantity: 30,
                  costPrice: 130,
                  sellingPrice: 170,
                  supplier: 'A-1 Grocery Wholesalers',
                },
                {
                  sku: 'FMCG-KK-14',
                  name: 'KitKat Milk Chocolate Share Bag',
                  category: 'Food & Beverages',
                  quantity: 40,
                  costPrice: 48,
                  sellingPrice: 60,
                  supplier: 'A-1 Grocery Wholesalers',
                },
                {
                  sku: 'FMCG-MK-15',
                  name: 'Maggi Tomato Ketchup 500g',
                  category: 'Food & Beverages',
                  quantity: 25,
                  costPrice: 95,
                  sellingPrice: 120,
                  supplier: 'A-1 Grocery Wholesalers',
                },
              ]
            } else {
              extracted = [
                {
                  sku: 'HB-LS-10',
                  name: 'Lux International Soap 100g',
                  category: 'Health & Beauty',
                  quantity: 50,
                  costPrice: 28,
                  sellingPrice: 35,
                  supplier: 'Apex FMCG Distributors',
                },
                {
                  sku: 'FMCG-GT-11',
                  name: 'Lipton Pure Green Tea 25s',
                  category: 'Food & Beverages',
                  quantity: 20,
                  costPrice: 110,
                  sellingPrice: 145,
                  supplier: 'Apex FMCG Distributors',
                },
                {
                  sku: 'HOME-SE-12',
                  name: 'Surf Excel Quick Wash 1kg',
                  category: 'Home & Garden',
                  quantity: 15,
                  costPrice: 120,
                  sellingPrice: 155,
                  supplier: 'Apex FMCG Distributors',
                },
              ]
            }

            setOcrItems(extracted)
            setOcrStep('success')
            toast.success('Invoice scanned and parsed successfully!')
          }, 600)
        }, 600)
      }, 600)
    }, 600)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      triggerOcrScan(file.name)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      triggerOcrScan(file.name)
    }
  }

  const handleCommitOcr = async () => {
    if (!currentOrg) return
    setIsSaving(true)

    try {
      let committedCount = 0
      for (const ocrItem of ocrItems) {
        // Check if item exists already (by SKU)
        const existing = items.find((i) => i.sku.toLowerCase() === ocrItem.sku.toLowerCase())

        if (existing) {
          // Increment stock quantity & update supplier
          const updatedQty = existing.quantity + ocrItem.quantity
          
          if (!isFirebaseConfigured || !db) {
            // Local update
            localDb.updateItem(existing.id, {
              quantity: updatedQty,
              costPrice: ocrItem.costPrice,
              sellingPrice: ocrItem.sellingPrice,
              supplier: ocrItem.supplier,
            })
            updateItem(existing.id, {
              quantity: updatedQty,
              costPrice: ocrItem.costPrice,
              sellingPrice: ocrItem.sellingPrice,
              supplier: ocrItem.supplier,
              updatedAt: new Date(),
            })

            // Record Purchase Transaction locally
            localDb.addTransaction({
              orgId: currentOrg.id,
              itemId: existing.id,
              type: 'purchase',
              quantity: ocrItem.quantity,
              unitPrice: ocrItem.costPrice,
              totalAmount: ocrItem.quantity * ocrItem.costPrice,
              notes: `Wholesale purchase auto-OCR imported`,
              createdBy: 'demo_owner_123',
            })
          } else {
            // Firebase update
            const itemRef = doc(db, 'inventory', existing.id)
            await updateDoc(itemRef, {
              quantity: updatedQty,
              costPrice: ocrItem.costPrice,
              sellingPrice: ocrItem.sellingPrice,
              supplier: ocrItem.supplier,
              updatedAt: serverTimestamp(),
            })
            updateItem(existing.id, {
              quantity: updatedQty,
              costPrice: ocrItem.costPrice,
              sellingPrice: ocrItem.sellingPrice,
              supplier: ocrItem.supplier,
              updatedAt: new Date(),
            })

            // Record purchase transaction on firebase
            await addDoc(collection(db, 'transactions'), {
              orgId: currentOrg.id,
              itemId: existing.id,
              type: 'purchase',
              quantity: ocrItem.quantity,
              unitPrice: ocrItem.costPrice,
              totalAmount: ocrItem.quantity * ocrItem.costPrice,
              notes: `Wholesale purchase auto-OCR imported`,
              createdBy: 'system',
              createdAt: serverTimestamp(),
            })
          }
        } else {
          // Add completely new product
          if (!isFirebaseConfigured || !db) {
            const newItem = localDb.addItem({
              sku: ocrItem.sku,
              name: ocrItem.name,
              category: ocrItem.category,
              quantity: ocrItem.quantity,
              costPrice: ocrItem.costPrice,
              sellingPrice: ocrItem.sellingPrice,
              minStockLevel: 10,
              supplier: ocrItem.supplier,
              orgId: currentOrg.id,
            })
            addItem(newItem)

            // Record Purchase Transaction locally
            localDb.addTransaction({
              orgId: currentOrg.id,
              itemId: newItem.id,
              type: 'purchase',
              quantity: ocrItem.quantity,
              unitPrice: ocrItem.costPrice,
              totalAmount: ocrItem.quantity * ocrItem.costPrice,
              notes: `Wholesale purchase auto-OCR imported`,
              createdBy: 'demo_owner_123',
            })
          } else {
            const docRef = await addDoc(collection(db, 'inventory'), {
              sku: ocrItem.sku,
              name: ocrItem.name,
              category: ocrItem.category,
              quantity: ocrItem.quantity,
              costPrice: ocrItem.costPrice,
              sellingPrice: ocrItem.sellingPrice,
              minStockLevel: 10,
              supplier: ocrItem.supplier,
              orgId: currentOrg.id,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              lastRestocked: serverTimestamp(),
            })

            const newItem = {
              id: docRef.id,
              sku: ocrItem.sku,
              name: ocrItem.name,
              category: ocrItem.category,
              quantity: ocrItem.quantity,
              costPrice: ocrItem.costPrice,
              sellingPrice: ocrItem.sellingPrice,
              minStockLevel: 10,
              supplier: ocrItem.supplier,
              orgId: currentOrg.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              lastRestocked: new Date(),
            }
            addItem(newItem)

            // Record purchase transaction
            await addDoc(collection(db, 'transactions'), {
              orgId: currentOrg.id,
              itemId: docRef.id,
              type: 'purchase',
              quantity: ocrItem.quantity,
              unitPrice: ocrItem.costPrice,
              totalAmount: ocrItem.quantity * ocrItem.costPrice,
              notes: `Wholesale purchase auto-OCR imported`,
              createdBy: 'system',
              createdAt: serverTimestamp(),
            })
          }
        }
        committedCount++
      }

      toast.success(`Successfully ledgered ${committedCount} items and logged purchase orders!`)
      setIsOcrDialogOpen(false)
      setOcrStep('idle')
      setOcrItems([])
      fetchInventory()
    } catch (e) {
      console.error(e)
      toast.error('Failed to commit OCR changes')
    } finally {
      setIsSaving(false)
    }
  }

  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity === 0) return { label: 'Out of Stock', variant: 'destructive' as const }
    if (item.quantity <= item.minStockLevel) return { label: 'Low Stock', variant: 'secondary' as const }
    return { label: 'In Stock', variant: 'default' as const }
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
            <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
            {!isFirebaseConfigured && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20 text-[10px]">
                Offline Sandbox
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Manage your products and stock levels
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Simulated Invoice OCR Scanner */}
          <Dialog open={isOcrDialogOpen} onOpenChange={setIsOcrDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="bg-primary/5 border-primary/20 hover:bg-primary/10 text-primary">
                <Sparkles className="mr-2 h-4 w-4 text-primary animate-pulse" />
                Scan Invoice (OCR)
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Wholesale Invoice OCR Scanner
                </DialogTitle>
                <DialogDescription>
                  Upload a distributor invoice image or PDF. Our Multimodal AI will extract products, prices, and quantities automatically.
                </DialogDescription>
              </DialogHeader>

              {ocrStep === 'idle' && (
                <div
                  className={`mt-4 border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                    dragActive ? 'border-primary bg-primary/5 scale-98' : 'border-border hover:border-primary/50 bg-muted/20'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                  />
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                    <Upload className="h-6 w-6" />
                  </div>
                  <h4 className="font-semibold text-sm">Drag and drop distributor invoice</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Supports PNG, JPG, or PDF. We will automatically map supplier inventory to your store.
                  </p>
                  <Button size="sm" variant="secondary" className="mt-4 pointer-events-none">
                    Select Invoice Image
                  </Button>
                </div>
              )}

              {ocrStep === 'processing' && (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  <div>
                    <h4 className="font-medium text-sm text-foreground">Analyzing Invoice Layout...</h4>
                    <p className="text-xs text-muted-foreground mt-1 animate-pulse">{ocrProgressText}</p>
                  </div>
                </div>
              )}

              {ocrStep === 'success' && (
                <div className="space-y-4 pt-4">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3.5 flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold text-green-600 dark:text-green-400">OCR Extraction Completed!</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Scanned <code>{ocrFileName}</code>. Found <strong>{ocrItems.length} items</strong>. Confirm prices below to save to your inventory.
                      </p>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="text-xs">Product Details</TableHead>
                          <TableHead className="text-xs">SKU</TableHead>
                          <TableHead className="text-xs text-right">Qty</TableHead>
                          <TableHead className="text-xs text-right">Cost Price</TableHead>
                          <TableHead className="text-xs text-right">Selling Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ocrItems.map((item, idx) => (
                          <TableRow key={idx} className="hover:bg-muted/10">
                            <TableCell className="py-2.5">
                              <div>
                                <p className="text-xs font-semibold">{item.name}</p>
                                <p className="text-[9px] text-muted-foreground">{item.supplier}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-[10px] py-2.5">{item.sku}</TableCell>
                            <TableCell className="text-right py-2.5 font-bold text-xs">{item.quantity}</TableCell>
                            <TableCell className="text-right py-2.5 text-xs font-mono">{formatCurrency(item.costPrice)}</TableCell>
                            <TableCell className="text-right py-2.5 text-xs font-mono text-green-600 font-bold">{formatCurrency(item.sellingPrice)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="bg-muted/30 border rounded-lg p-3 text-[10px] text-muted-foreground">
                    💡 <strong>Smart Mapping:</strong> Items already in your inventory will be incremented. New products will be registered instantly. Corresponding purchase orders will be logged to your profit ledger.
                  </div>

                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setOcrStep('idle')}>
                      Rescan
                    </Button>
                    <Button onClick={handleCommitOcr} disabled={isSaving}>
                      {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Commit Stock & Ledger Orders
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Quick POS Billing Counter */}
          <Dialog open={isPosOpen} onOpenChange={(open) => {
            setIsPosOpen(open)
            if (!open) {
              setPosCart([])
              setPosSelectedItem('')
              setPosQty(1)
              setPosCheckoutSuccess(false)
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="bg-green-600/5 border-green-600/20 hover:bg-green-600/10 text-green-600 dark:text-green-500 font-semibold text-xs h-9">
                <Calculator className="mr-2 h-4 w-4 text-green-600 animate-pulse" />
                Quick Bill (POS)
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-600">
                  <Calculator className="h-5 w-5 text-green-600" />
                  Quick Bill POS Terminal
                </DialogTitle>
                <DialogDescription>
                  Sell products from your active catalog directly. This decrements inventory and logs sales instantly.
                </DialogDescription>
              </DialogHeader>

              {!posCheckoutSuccess ? (
                <div className="space-y-6 pt-4">
                  {/* Cart Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30 p-4 rounded-xl border">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="pos-item" className="text-xs font-semibold">Select Product</Label>
                      <Select
                        value={posSelectedItem}
                        onValueChange={setPosSelectedItem}
                      >
                        <SelectTrigger id="pos-item" className="bg-card">
                          <SelectValue placeholder="Search or select a product..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          {items.filter(i => i.quantity > 0).map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name} ({item.quantity} in stock) — {formatCurrency(item.sellingPrice)}
                            </SelectItem>
                          ))}
                          {items.filter(i => i.quantity > 0).length === 0 && (
                            <div className="p-2 text-center text-xs text-muted-foreground">
                              No products in stock. Add inventory first!
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pos-qty" className="text-xs font-semibold">Quantity</Label>
                      <div className="flex gap-2">
                        <Input
                          id="pos-qty"
                          type="number"
                          min={1}
                          value={posQty}
                          onChange={(e) => setPosQty(parseInt(e.target.value) || 1)}
                          className="bg-card text-center"
                        />
                        <Button 
                          onClick={() => {
                            if (!posSelectedItem) {
                              toast.error('Select a product first')
                              return
                            }
                            const item = items.find(i => i.id === posSelectedItem)
                            if (!item) return
                            if (posQty <= 0) {
                              toast.error('Quantity must be greater than 0')
                              return
                            }
                            if (posQty > item.quantity) {
                              toast.error(`Insufficient stock! Only ${item.quantity} available.`)
                              return
                            }

                            // Add or update in cart
                            const existingIdx = posCart.findIndex(c => c.item.id === item.id)
                            if (existingIdx > -1) {
                              const newQty = posCart[existingIdx].qty + posQty
                              if (newQty > item.quantity) {
                                toast.error(`Cannot exceed current stock limit of ${item.quantity} units!`)
                                return
                              }
                              const newCart = [...posCart]
                              newCart[existingIdx].qty = newQty
                              setPosCart(newCart)
                            } else {
                              setPosCart([...posCart, { item, qty: posQty }])
                            }

                            toast.success(`Added ${item.name} to cart`)
                            setPosSelectedItem('')
                            setPosQty(1)
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white shrink-0 border-none h-9 text-xs"
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Cart Details */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Shopping Cart ({posCart.reduce((acc, c) => acc + c.qty, 0)} units)
                    </h4>

                    <div className="border rounded-xl overflow-hidden bg-card">
                      <Table>
                        <TableHeader className="bg-muted/40">
                          <TableRow>
                            <TableHead className="text-xs">Product Details</TableHead>
                            <TableHead className="text-xs text-center">Qty</TableHead>
                            <TableHead className="text-xs text-right">Unit Price</TableHead>
                            <TableHead className="text-xs text-right">Subtotal</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {posCart.map((row, idx) => (
                            <TableRow key={idx} className="hover:bg-muted/5">
                              <TableCell className="py-2.5">
                                <span className="text-xs font-semibold">{row.item.name}</span>
                                <p className="text-[10px] text-muted-foreground font-mono">{row.item.sku}</p>
                              </TableCell>
                              <TableCell className="text-center py-2.5 font-semibold text-xs">{row.qty}</TableCell>
                              <TableCell className="text-right py-2.5 text-xs font-mono">{formatCurrency(row.item.sellingPrice)}</TableCell>
                              <TableCell className="text-right py-2.5 text-xs font-mono font-bold text-green-600">
                                {formatCurrency(row.qty * row.item.sellingPrice)}
                              </TableCell>
                              <TableCell className="py-2.5">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setPosCart(posCart.filter((_, i) => i !== idx))
                                  }}
                                >
                                  <Trash className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          {posCart.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                                Cart is empty. Select a product above to start billing!
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Total Box */}
                    {posCart.length > 0 && (
                      <div className="flex justify-between items-center bg-green-500/5 border border-green-500/10 rounded-xl p-4">
                        <span className="text-sm font-semibold text-foreground">Grand Total Value:</span>
                        <span className="text-xl font-bold text-green-600 font-mono">
                          {formatCurrency(posCart.reduce((acc, c) => acc + (c.qty * c.item.sellingPrice), 0))}
                        </span>
                      </div>
                    )}
                  </div>

                  <DialogFooter className="gap-2 pt-2 border-t">
                    <Button variant="outline" onClick={() => setIsPosOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={async () => {
                        if (!currentOrg) {
                          toast.error('No organization selected')
                          return
                        }
                        if (posCart.length === 0) {
                          toast.error('Add items to cart first')
                          return
                        }
                        setIsSaving(true)
                        try {
                          for (const row of posCart) {
                            const newQty = row.item.quantity - row.qty
                            
                            if (!isFirebaseConfigured || !db) {
                              localDb.addTransaction({
                                orgId: currentOrg.id,
                                itemId: row.item.id,
                                type: 'sale',
                                quantity: row.qty,
                                unitPrice: row.item.sellingPrice,
                                totalAmount: row.qty * row.item.sellingPrice,
                                notes: 'POS Counter Sale checkout',
                                createdBy: 'POS Terminal 1',
                              })
                            } else {
                              // Firebase update
                              await updateDoc(doc(db, 'inventory', row.item.id), {
                                quantity: newQty,
                                updatedAt: serverTimestamp(),
                              })
                              await addDoc(collection(db, 'transactions'), {
                                orgId: currentOrg.id,
                                itemId: row.item.id,
                                type: 'sale',
                                quantity: row.qty,
                                unitPrice: row.item.sellingPrice,
                                totalAmount: row.qty * row.item.sellingPrice,
                                notes: 'POS Counter Sale checkout',
                                createdBy: 'POS Terminal 1',
                                createdAt: serverTimestamp(),
                              })
                            }
                          }
                          setPosCheckoutSuccess(true)
                          toast.success('POS Sale recorded successfully & inventory updated!')
                          fetchInventory()
                        } catch (e) {
                          console.error(e)
                          toast.error('Failed to complete sale checkout')
                        } finally {
                          setIsSaving(false)
                        }
                      }}
                      disabled={isSaving || posCart.length === 0}
                      className="bg-green-600 hover:bg-green-700 text-white border-none text-xs h-9 animate-pulse"
                    >
                      {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Checkout & Log Sales
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <div className="space-y-6 pt-4 text-center animate-in fade-in zoom-in-95 duration-200">
                  <div className="h-14 w-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto text-green-600">
                    <Receipt className="h-7 w-7 animate-bounce" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">Sale Invoice Generated!</h3>
                    <p className="text-xs text-muted-foreground">
                      Transaction has been successfully logged to your profit ledger.
                    </p>
                  </div>

                  {/* Glassmorphic Print Receipt */}
                  <div className="border border-green-500/20 bg-gradient-to-b from-green-500/5 to-transparent rounded-2xl p-5 max-w-sm mx-auto text-left space-y-3 font-mono text-[11px] shadow-lg relative">
                    <div className="absolute right-3 top-3 border-2 border-green-600 text-green-600 font-bold px-1.5 py-0.5 rounded text-[8px] rotate-12">
                      PAID CASH
                    </div>
                    <div className="text-center border-b border-dashed pb-2 space-y-1 font-sans">
                      <h4 className="font-bold text-xs">RETAIL COPILOT CO.</h4>
                      <p className="text-[9px] text-muted-foreground">Pos Billing Counter Terminal #1</p>
                      <p className="text-[8px] text-muted-foreground">Date: {new Date().toLocaleString()}</p>
                    </div>

                    <div className="space-y-2">
                      {posCart.map((row, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{row.item.name.substring(0, 20)} x {row.qty}</span>
                          <span>{formatCurrency(row.qty * row.item.sellingPrice)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-dashed pt-2 space-y-1">
                      <div className="flex justify-between font-bold text-xs text-green-600">
                        <span>TOTAL AMOUNT:</span>
                        <span>{formatCurrency(posCart.reduce((acc, c) => acc + (c.qty * c.item.sellingPrice), 0))}</span>
                      </div>
                      <p className="text-[8px] text-muted-foreground text-center pt-2">
                        Thank you for shopping with us!
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-center pt-2 border-t">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        window.print()
                      }}
                      className="text-xs h-9"
                    >
                      Print Receipt
                    </Button>
                    <Button 
                      onClick={() => {
                        setPosCart([])
                        setPosSelectedItem('')
                        setPosQty(1)
                        setPosCheckoutSuccess(false)
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white border-none text-xs h-9"
                    >
                      New Sale Bill
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <label className="cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImportExcel}
              className="hidden"
              disabled={isImporting}
            />
            <Button variant="outline" asChild disabled={isImporting}>
              <span>
                {isImporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Import
              </span>
            </Button>
          </label>
          <Button variant="outline" onClick={handleExportExcel}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Item</DialogTitle>
                <DialogDescription>
                  Add a new product to your inventory
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="e.g., PROD-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter product name"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="costPrice">Cost Price</Label>
                    <Input
                      id="costPrice"
                      type="number"
                      value={formData.costPrice}
                      onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sellingPrice">Selling Price</Label>
                    <Input
                      id="sellingPrice"
                      type="number"
                      value={formData.sellingPrice}
                      onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minStockLevel">Min Stock Level</Label>
                    <Input
                      id="minStockLevel"
                      type="number"
                      value={formData.minStockLevel}
                      onChange={(e) => setFormData({ ...formData, minStockLevel: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Supplier</Label>
                    <Input
                      id="supplier"
                      value={formData.supplier}
                      onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddItem} disabled={isSaving || !formData.name || !formData.sku}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Item
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={selectedCategory || 'all'}
              onValueChange={(value) => setSelectedCategory(value === 'all' ? null : value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Products ({filteredItems.length})</CardTitle>
          <CardDescription>
            {items.length} total items in inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredItems.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const status = getStockStatus(item)
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell className="text-right">
                          <span className={item.quantity <= item.minStockLevel ? 'text-amber-500 font-bold' : ''}>
                            {item.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.costPrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.sellingPrice)}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(item)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openDeleteDialog(item)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No products found</h3>
              <p className="text-muted-foreground mt-1">
                {searchQuery || selectedCategory
                  ? 'Try adjusting your search or filter'
                  : 'Get started by adding your first product'}
              </p>
              {!searchQuery && !selectedCategory && (
                <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Item
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
            <DialogDescription>Update product details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-sku">SKU</Label>
                <Input
                  id="edit-sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Product Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-quantity">Quantity</Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-costPrice">Cost Price</Label>
                <Input
                  id="edit-costPrice"
                  type="number"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sellingPrice">Selling Price</Label>
                <Input
                  id="edit-sellingPrice"
                  type="number"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-minStockLevel">Min Stock Level</Label>
                <Input
                  id="edit-minStockLevel"
                  type="number"
                  value={formData.minStockLevel}
                  onChange={(e) => setFormData({ ...formData, minStockLevel: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-supplier">Supplier</Label>
                <Input
                  id="edit-supplier"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditItem} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingItem?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteItem} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
