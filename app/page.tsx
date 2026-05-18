'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Package,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  BarChart3,
  Shield,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react'
import { isFirebaseConfigured } from '@/lib/firebase'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const features = [
  {
    icon: Package,
    title: 'Smart Inventory Management',
    description: 'Track stock levels in real-time with bulk Excel imports, automatic low-stock alerts, and shelf-location maps.',
  },
  {
    icon: TrendingUp,
    title: 'Profit Analytics',
    description: 'Monitor sales performance, track profit margins, and visualize revenue trends with high-fidelity Recharts graphs.',
  },
  {
    icon: AlertTriangle,
    title: 'Dead Stock Detection',
    description: 'Identify slow-moving inventory automatically and execute Clearance campaigns to free up capital.',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Insights',
    description: 'Get intelligent recommendations for pricing, restocking, and supplier switching powered by 7 specialized agents.',
  },
  {
    icon: BarChart3,
    title: 'WhatsApp Business Assistant',
    description: 'A two-way conversational copilot simulator that lets you receive low stock warnings and approve actions directly.',
  },
  {
    icon: Shield,
    title: 'Multi-Store & Tenant Structure',
    description: 'Manage multiple warehouses and outlets. Isolation by business with Role-based access (Owner, Manager, Staff).',
  },
]

const benefits = [
  'Reduce dead stock by up to 40%',
  'Save 10+ hours per week on manual checks',
  'Improve profit margins with explainable AI pricing',
  'One-click WhatsApp operations approvals',
  'Seamless offline-first local mode + cloud sync capability',
]

export default function LandingPage() {
  const steps = [
    {
      title: 'Create a Firebase Project',
      description: 'Go to the Firebase Console and create a new project',
      link: 'https://console.firebase.google.com',
    },
    {
      title: 'Enable Authentication',
      description: 'In your Firebase project, go to Authentication > Sign-in method and enable Email/Password and Google providers',
    },
    {
      title: 'Create Firestore Database',
      description: 'Go to Firestore Database and create a database in production mode',
    },
    {
      title: 'Get Your Config',
      description: 'Go to Project Settings > General > Your apps > Web app and copy the config values',
    },
    {
      title: 'Add Environment Variables',
      description: 'Create a .env.local file in the root of the project with the copied variables:',
      variables: [
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
        'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
        'NEXT_PUBLIC_FIREBASE_APP_ID',
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Local-First Banner */}
      {!isFirebaseConfigured && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-500 text-xs py-2.5 px-4 text-center flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <Sparkles className="h-3.5 w-3.5 animate-pulse text-amber-500 shrink-0" />
          <span>Running in <strong>Local Sandbox Mode</strong>. Data is persisted securely in your browser.</span>
          <Dialog>
            <DialogTrigger asChild>
              <button className="font-bold underline text-amber-700 dark:text-amber-400 hover:text-amber-600 cursor-pointer ml-1">
                Configure Firebase Cloud Sync
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Firebase Cloud Setup Guide
                </DialogTitle>
                <DialogDescription>
                  To sync your local data with a real cloud database and enable team collaboration, follow these steps to connect your own Firebase project.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 pt-4">
                <ol className="space-y-4">
                  {steps.map((step, index) => (
                    <li key={index} className="flex gap-4">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-muted-foreground/20 text-xs font-semibold">
                        {index + 1}
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold leading-none pt-0.5">{step.title}</p>
                        <p className="text-xs text-muted-foreground">{step.description}</p>
                        {step.link && (
                          <Button variant="link" className="h-auto p-0 text-xs" asChild>
                            <a href={step.link} target="_blank" rel="noopener noreferrer">
                              Open Firebase Console <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          </Button>
                        )}
                        {step.variables && (
                          <ul className="mt-2 space-y-1 rounded-md bg-muted p-2.5 font-mono text-[10px]">
                            {step.variables.map((v) => (
                              <li key={v} className="flex items-center gap-1.5 text-muted-foreground">
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                {v}=...
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                  After creating the <code>.env.local</code> file and adding the parameters, restart your development server to enable full Firebase cloud integration.
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <Package className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold tracking-tight">Retail Copilot</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/signup">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              AI Business Operating System for Retailers
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-balance">
              The WhatsApp-First{' '}
              <span className="text-primary">AI Operating System</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
              Transform your supermarket, pharmacy, D2C brand, or retail shop. 
              Track inventory, monitor margins, detect dead stock, and execute operations 
              directly from an AI WhatsApp Assistant.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup" className="w-full sm:w-auto">
                <Button size="lg" className="w-full text-base h-12 px-8">
                  Get Started (Local Sandbox)
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full text-base h-12 px-8">
                  Sign In to Demo
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Instant login in local mode with: <code>owner@retailbot.co</code> / <code>password</code>
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to optimize profit
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Built for retail operations, profit tracking, and immediate business decision support.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-border bg-card p-8 transition-all hover:border-primary/50 hover:shadow-lg"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20 items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl font-semibold">
                Built for retailers who mean business
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Whether you manage a kirana store, direct-to-consumer brand, or modern warehouse, 
                our specialized agents analyze your transactions automatically.
              </p>
              <ul className="mt-8 space-y-4">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-10">
                <Link href="/signup">
                  <Button size="lg">
                    Start Free Demo
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-8 lg:p-12">
                <div className="h-full w-full rounded-xl bg-card border border-border shadow-2xl flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary mx-auto mb-6">
                      <Package className="h-10 w-10 text-primary-foreground" />
                    </div>
                    <p className="text-4xl font-bold">100% Local</p>
                    <p className="text-muted-foreground mt-2">Zero cloud lock-in. Full sovereignty.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Package className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">Retail Copilot</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Built with care for SMB Retailers. Offline Sandbox Active.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
