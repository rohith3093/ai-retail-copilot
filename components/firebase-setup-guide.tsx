'use client'

import { AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function FirebaseSetupGuide() {
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
      description: 'Click the Settings icon (top right) > Vars and add the following variables:',
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>
          <CardTitle className="text-2xl">Firebase Setup Required</CardTitle>
          <CardDescription>
            To use the AI Retail Copilot, you need to configure Firebase. Follow the steps below to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ol className="space-y-4">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/20 text-sm font-medium">
                  {index + 1}
                </div>
                <div className="space-y-1">
                  <p className="font-medium leading-none pt-1">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                  {step.link && (
                    <Button variant="link" className="h-auto p-0 text-sm" asChild>
                      <a href={step.link} target="_blank" rel="noopener noreferrer">
                        Open Firebase Console <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  )}
                  {step.variables && (
                    <ul className="mt-2 space-y-1 rounded-md bg-muted p-3 font-mono text-xs">
                      {step.variables.map((v) => (
                        <li key={v} className="flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                          {v}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Note:</strong> After adding the environment variables, 
              refresh the page to connect to Firebase. The app will automatically detect the configuration.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
