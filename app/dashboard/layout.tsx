'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/providers'
import { useOrgStore, useUIStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Package,
  LayoutDashboard,
  BoxesIcon,
  TrendingUp,
  AlertTriangle,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Loader2,
  MessageSquare,
  Truck,
  ShoppingBag,
} from 'lucide-react'
import { useTheme } from 'next-themes'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/inventory', icon: BoxesIcon, label: 'Inventory' },
  { href: '/dashboard/analytics', icon: TrendingUp, label: 'Analytics' },
  { href: '/dashboard/dead-stock', icon: AlertTriangle, label: 'Dead Stock' },
  { href: '/dashboard/whatsapp', icon: MessageSquare, label: 'WhatsApp Copilot' },
  { href: '/dashboard/suppliers', icon: Truck, label: 'Suppliers' },
  { href: '/dashboard/shopify', icon: ShoppingBag, label: 'Shopify Sync' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading, signOut } = useAuth()
  const { currentOrg, orgs } = useOrgStore()
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    } else if (!isLoading && user && orgs.length === 0) {
      router.push('/onboarding')
    }
  }, [user, isLoading, orgs, router])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user || !currentOrg) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen border-r border-border bg-sidebar transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-[72px]'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
                <Package className="h-5 w-5 text-sidebar-primary-foreground" />
              </div>
              {sidebarOpen && (
                <span className="font-semibold text-sidebar-foreground">Retail Copilot</span>
              )}
            </Link>
          </div>

          {/* Organization */}
          {sidebarOpen && (
            <div className="px-4 py-3 border-b border-sidebar-border">
              <p className="text-xs text-muted-foreground mb-1">Organization</p>
              <p className="font-medium text-sm text-sidebar-foreground truncate">
                {currentOrg.name}
              </p>
            </div>
          )}

          {/* Navigation */}
          <ScrollArea className="flex-1 py-4">
            <nav className="space-y-1 px-3">
              {navItems.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== '/dashboard' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {sidebarOpen && <span>{item.label}</span>}
                  </Link>
                )
              })}
            </nav>
          </ScrollArea>

          <Separator className="bg-sidebar-border" />

          {/* Toggle & User */}
          <div className="p-3 space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground"
              onClick={toggleSidebar}
            >
              {sidebarOpen ? (
                <>
                  <ChevronLeft className="h-5 w-5 mr-3" />
                  <span>Collapse</span>
                </>
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start gap-3 h-auto py-2',
                    !sidebarOpen && 'justify-center px-0'
                  )}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.photoURL} alt={user.displayName} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {user.displayName?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {sidebarOpen && (
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-sidebar-foreground truncate">
                        {user.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                  {theme === 'dark' ? (
                    <Sun className="mr-2 h-4 w-4" />
                  ) : (
                    <Moon className="mr-2 h-4 w-4" />
                  )}
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          'flex-1 transition-all duration-300',
          sidebarOpen ? 'ml-64' : 'ml-[72px]'
        )}
      >
        <div className="min-h-screen p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}
