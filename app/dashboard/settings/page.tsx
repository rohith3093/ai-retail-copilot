'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers'
import { useOrgStore } from '@/lib/store'
import { db, isFirebaseConfigured } from '@/lib/firebase'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Building2, User, Bell, Palette, Loader2, Save, Cpu, Sparkles } from 'lucide-react'
import { localDb, type LocalAiConfig } from '@/lib/localDb'

export default function SettingsPage() {
  const { user } = useAuth()
  const { currentOrg, setCurrentOrg } = useOrgStore()
  const { theme, setTheme } = useTheme()
  const [isSaving, setIsSaving] = useState(false)
  const [orgName, setOrgName] = useState(currentOrg?.name || '')
  const [lowStockThreshold, setLowStockThreshold] = useState(
    currentOrg?.settings?.lowStockThreshold || 10
  )
  const [deadStockDays, setDeadStockDays] = useState(
    currentOrg?.settings?.deadStockDays || 90
  )
  const [taxRate, setTaxRate] = useState(currentOrg?.settings?.taxRate || 18)

  // AI Switcher Config States
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai' | 'ollama' | 'lmstudio'>('gemini')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('llama3')
  const [openAiKey, setOpenAiKey] = useState('')
  const [geminiKey, setGeminiKey] = useState('')

  // Load AI configuration on mount
  useEffect(() => {
    const config = localDb.getAiConfig()
    setAiProvider(config.provider)
    setOllamaUrl(config.ollamaUrl || 'http://localhost:11434')
    setOllamaModel(config.ollamaModel || 'llama3')
    setOpenAiKey(config.openAiKey || '')
    setGeminiKey(config.geminiKey || '')
  }, [])

  const handleSaveOrg = async () => {
    if (!currentOrg) return

    setIsSaving(true)
    try {
      if (!isFirebaseConfigured || !db) {
        // LOCAL CRUD SAVE
        localDb.updateOrgSettings(
          currentOrg.id,
          orgName,
          {
            ...currentOrg.settings,
            lowStockThreshold,
            deadStockDays,
            taxRate,
          }
        )
        setCurrentOrg({
          ...currentOrg,
          name: orgName,
          settings: {
            ...currentOrg.settings,
            lowStockThreshold,
            deadStockDays,
            taxRate,
          },
        })
        toast.success('Offline settings saved successfully')
        return
      }

      const orgRef = doc(db, 'organizations', currentOrg.id)
      await updateDoc(orgRef, {
        name: orgName,
        settings: {
          ...currentOrg.settings,
          lowStockThreshold,
          deadStockDays,
          taxRate,
        },
        updatedAt: serverTimestamp(),
      })

      setCurrentOrg({
        ...currentOrg,
        name: orgName,
        settings: {
          ...currentOrg.settings,
          lowStockThreshold,
          deadStockDays,
          taxRate,
        },
      })

      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveAiConfig = () => {
    const newConfig: LocalAiConfig = {
      provider: aiProvider,
      ollamaUrl,
      ollamaModel,
      openAiKey,
      geminiKey,
    }
    localDb.saveAiConfig(newConfig)
    toast.success('AI Model configuration updated')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and business preferences
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your personal account details</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={user?.displayName || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ''} disabled />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Profile information is managed through your authentication provider.
          </p>
        </CardContent>
      </Card>

      {/* Local AI Model Switcher Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
              <Cpu className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-1.5">
                AI Model Switcher
                <Badge variant="outline" className="border-primary/30 text-primary text-[9px] h-4">
                  Multi-Agent Brain
                </Badge>
              </CardTitle>
              <CardDescription>Toggle between local offline LLMs and secure cloud providers</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="aiProvider">Active AI Provider</Label>
            <Select value={aiProvider} onValueChange={(val) => setAiProvider(val as any)}>
              <SelectTrigger id="aiProvider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Google Gemini (Recommended Cloud)</SelectItem>
                <SelectItem value="openai">OpenAI GPT-4o (Cloud)</SelectItem>
                <SelectItem value="ollama">Ollama (Offline Local)</SelectItem>
                <SelectItem value="lmstudio">LM Studio (Offline Local)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Configure which LLM powers the specialized inventory, profit, forecasting, and WhatsApp agents.
            </p>
          </div>

          <Separator className="my-2" />

          {/* Dynamic Provider Form Inputs */}
          {aiProvider === 'gemini' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="geminiKey">Gemini API Key</Label>
                <Input
                  id="geminiKey"
                  type="password"
                  placeholder="AIzaSy..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  If left blank, the app will gracefully fall back to our high-fidelity rule-based offline simulation.
                </p>
              </div>
            </div>
          )}

          {aiProvider === 'openai' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="openAiKey">OpenAI API Key</Label>
                <Input
                  id="openAiKey"
                  type="password"
                  placeholder="sk-proj-..."
                  value={openAiKey}
                  onChange={(e) => setOpenAiKey(e.target.value)}
                />
              </div>
            </div>
          )}

          {aiProvider === 'ollama' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ollamaUrl">Ollama Server URL</Label>
                <Input
                  id="ollamaUrl"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ollamaModel">Target LLM Model</Label>
                <Input
                  id="ollamaModel"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="llama3, mistral, etc."
                />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                💡 <strong>Local Check:</strong> Ensure your local Ollama server is running by executing <code>ollama run llama3</code> in your terminal before running audits.
              </p>
            </div>
          )}

          {aiProvider === 'lmstudio' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="lmStudio">LM Studio Host URL</Label>
                <Input
                  id="lmStudio"
                  value="http://localhost:1234/v1"
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Connects to the Local Inference Server running on port 1234. Load any GGUF model in LM Studio and enable the developer server.
                </p>
              </div>
            </div>
          )}

          <Button onClick={handleSaveAiConfig} className="bg-primary hover:bg-primary/95">
            <Sparkles className="mr-2 h-4 w-4 text-primary-foreground animate-pulse" />
            Save AI Settings
          </Button>
        </CardContent>
      </Card>

      {/* Organization */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Organization</CardTitle>
              <CardDescription>Business settings and preferences</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Business Name</Label>
            <Input
              id="orgName"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="lowStock">Low Stock Threshold</Label>
              <Input
                id="lowStock"
                type="number"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Alert when stock falls below this level
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadStock">Dead Stock Days</Label>
              <Input
                id="deadStock"
                type="number"
                value={deadStockDays}
                onChange={(e) => setDeadStockDays(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Mark as dead stock after this many days
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxRate">GST Rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Default tax rate for calculations
              </p>
            </div>
          </div>

          <Button onClick={handleSaveOrg} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Palette className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize how the app looks</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dark Mode</p>
              <p className="text-sm text-muted-foreground">
                Use dark theme for the interface
              </p>
            </div>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Alert preferences</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Low Stock Alerts</p>
              <p className="text-sm text-muted-foreground">
                Get notified when items fall below minimum stock
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dead Stock Alerts</p>
              <p className="text-sm text-muted-foreground">
                Get notified about slow-moving inventory
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Weekly Reports</p>
              <p className="text-sm text-muted-foreground">
                Receive weekly summary of your business
              </p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
