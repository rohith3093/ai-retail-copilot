'use client'

import { useState, useEffect } from 'react'
import { useOrgStore } from '@/lib/store'
import { localDb, type SupplierProfile } from '@/lib/localDb'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import {
  Building2,
  TrendingUp,
  TrendingDown,
  Clock,
  Phone,
  Mail,
  Plus,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRightLeft,
} from 'lucide-react'

export default function SuppliersPage() {
  const { currentOrg } = useOrgStore()
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)

  // Form States
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [leadTime, setLeadTime] = useState(3)
  const [discount, setDiscount] = useState(2)

  const loadSuppliers = () => {
    if (!currentOrg) return
    setIsLoading(true)
    const list = localDb.getSuppliers(currentOrg.id)
    setSuppliers(list)
    setIsLoading(false)
  }

  useEffect(() => {
    loadSuppliers()
  }, [currentOrg])

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentOrg) return

    if (!name.trim()) {
      toast.error('Supplier name is required')
      return
    }

    const newSupplier: SupplierProfile = {
      id: `sup_${Date.now()}`,
      orgId: currentOrg.id,
      name,
      contactEmail: email || 'sales@' + name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com',
      contactPhone: phone || '+91 99999 88888',
      reliabilityScore: 85 + Math.floor(Math.random() * 15),
      itemsSuppliedCount: 0,
      leadTimeDays: Number(leadTime),
      costTrend: 'stable',
      baseDiscountPercentage: Number(discount),
    }

    localDb.saveSupplier(newSupplier)
    setSuppliers([...suppliers, newSupplier])
    setIsOpen(false)
    
    // Reset fields
    setName('')
    setEmail('')
    setPhone('')
    setLeadTime(3)
    setDiscount(2)
    
    toast.success(`${name} added to suppliers list`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Supplier Intelligence</h1>
          <p className="text-muted-foreground">
            Monitor vendor performance and maximize sourcing margins
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register Supplier</DialogTitle>
              <DialogDescription>
                Add new FMCG distributor or local wholesaler details
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSupplier} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="name">Supplier Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Balaji FMCG Distributors" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Contact Email</Label>
                  <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="sales@balaji.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Contact Phone</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98989 89898" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lead">Avg. Lead Time (Days)</Label>
                  <Input id="lead" type="number" value={leadTime} onChange={(e) => setLeadTime(Number(e.target.value))} min={1} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount">Base Discount (%)</Label>
                  <Input id="discount" type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} min={0} max={100} />
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit">Submit Registration</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sourcing Arbitrage Card */}
      <div className="rounded-2xl border bg-gradient-to-r from-violet-500/10 via-primary/5 to-transparent p-6 shadow-md border-primary/15 relative overflow-hidden">
        <div className="absolute right-0 top-0 -mr-6 -mt-6 h-24 w-24 rounded-full bg-primary/10 blur-lg"></div>
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Sourcing Arbitrage Recommendations</span>
              <Badge className="bg-primary/20 text-primary border-none text-[8px] h-4">Procurement AI</Badge>
            </div>
            <h3 className="text-sm font-bold text-foreground">Optimize procurement for Ariel Detergent Powder</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We detected a price variance between your suppliers. Apex FMCG Distributors charges ₹110 per unit, while A-1 Grocery Wholesalers offers a base cost of ₹105 (4.5% discount) on orders of 20+ units.
            </p>
            <div className="flex items-center gap-4 text-xs font-semibold text-primary pt-1">
              <span className="flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-amber-500" /> Save ₹100 per restock cycle
              </span>
              <span className="text-muted-foreground font-normal">|</span>
              <span className="flex items-center gap-1 cursor-pointer hover:underline text-primary" onClick={() => toast.info('Procurement preference set to A-1 Wholesalers!')}>
                <ArrowRightLeft className="h-3.5 w-3.5" /> Set default restock to A-1 Wholesalers
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Suppliers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Wholesalers & Distributors</CardTitle>
          <CardDescription>Performance tracking and lead time statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Reliability Score</TableHead>
                <TableHead className="text-center">Lead Time</TableHead>
                <TableHead className="text-center">Base Discount</TableHead>
                <TableHead>Cost Trend</TableHead>
                <TableHead>Contact Info</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((sup) => (
                <TableRow key={sup.id}>
                  <TableCell className="font-semibold">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      {sup.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3 min-w-[120px]">
                      <Progress value={sup.reliabilityScore} className="h-2 flex-1" />
                      <span className="text-xs font-bold flex items-center gap-1 shrink-0">
                        {sup.reliabilityScore}%
                        {sup.reliabilityScore >= 90 && <ShieldCheck className="h-3.5 w-3.5 text-green-500" />}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    <div className="flex items-center justify-center gap-1.5 text-xs">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {sup.leadTimeDays} days
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-bold text-green-500">
                    {sup.baseDiscountPercentage}%
                  </TableCell>
                  <TableCell>
                    {sup.costTrend === 'rising' ? (
                      <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-[9px] flex items-center gap-1 w-fit">
                        <TrendingUp className="h-3 w-3" /> Rising
                      </Badge>
                    ) : sup.costTrend === 'falling' ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[9px] flex items-center gap-1 w-fit">
                        <TrendingDown className="h-3 w-3" /> Falling
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-[9px] w-fit">
                        Stable
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="h-3 w-3" /> {sup.contactEmail}
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3 w-3" /> {sup.contactPhone}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
