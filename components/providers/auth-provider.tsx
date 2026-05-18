'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from '@/lib/firebase'
import { useAuthStore, useOrgStore } from '@/lib/store'
import type { User, Organization, OrgMember } from '@/lib/types'
import { localDb } from '@/lib/localDb'

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  createOrganization: (name: string) => Promise<Organization>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const { user, setUser, isLoading, setLoading } = useAuthStore()
  const { setCurrentOrg, setOrgs, setUserRole } = useOrgStore()

  useEffect(() => {
    // FALLBACK IF FIREBASE IS NOT CONFIGURED
    if (!isFirebaseConfigured || !auth || !db) {
      const localSessionUid = typeof window !== 'undefined' ? localStorage.getItem('retail_copilot_session_uid') : null
      if (localSessionUid) {
        const users = localDb.getUsers()
        const foundUser = users.find(u => u.id === localSessionUid)
        if (foundUser) {
          setUser(foundUser)

          // Load memberships & orgs
          const memberships = localDb.getOrgMemberships(localSessionUid)
          const allOrgs = localDb.getOrgs()
          const userOrgs = allOrgs.filter(org => memberships.some(m => m.orgId === org.id))
          setOrgs(userOrgs)

          // Set active org
          if (userOrgs.length > 0) {
            const currentOrg = useOrgStore.getState().currentOrg
            const stillValid = currentOrg && userOrgs.some(o => o.id === currentOrg.id)
            const activeOrg = stillValid ? currentOrg : userOrgs[0]
            setCurrentOrg(activeOrg)

            const activeMembership = memberships.find(m => m.orgId === activeOrg.id)
            setUserRole(activeMembership?.role || 'owner')
          }
        } else {
          setUser(null)
          setOrgs([])
          setCurrentOrg(null)
          setUserRole(null)
        }
      } else {
        setUser(null)
        setOrgs([])
        setCurrentOrg(null)
        setUserRole(null)
      }
      setLoading(false)
      return
    }

    // ORIGINAL FIREBASE FLOW
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser)
      
      if (fbUser) {
        const userRef = doc(db!, 'users', fbUser.uid)
        const userSnap = await getDoc(userRef)

        let userData: User
        if (userSnap.exists()) {
          userData = { id: userSnap.id, ...userSnap.data() } as User
        } else {
          userData = {
            id: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
            photoURL: fbUser.photoURL || undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          await setDoc(userRef, {
            ...userData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        }

        setUser(userData)

        // Fetch memberships
        const membershipsQuery = query(
          collection(db!, 'org_members'),
          where('userId', '==', fbUser.uid)
        )
        const membershipsSnap = await getDocs(membershipsQuery)
        
        const orgPromises = membershipsSnap.docs.map(async (memberDoc) => {
          const membership = memberDoc.data() as OrgMember
          const orgRef = doc(db!, 'organizations', membership.orgId)
          const orgSnap = await getDoc(orgRef)
          return orgSnap.exists() ? { id: orgSnap.id, ...orgSnap.data() } as Organization : null
        })

        const orgs = (await Promise.all(orgPromises)).filter(Boolean) as Organization[]
        setOrgs(orgs)

        if (orgs.length > 0) {
          const currentOrg = useOrgStore.getState().currentOrg
          if (!currentOrg || !orgs.find(o => o.id === currentOrg.id)) {
            setCurrentOrg(orgs[0])
            const membership = membershipsSnap.docs.find(
              d => d.data().orgId === orgs[0].id
            )?.data() as OrgMember | undefined
            setUserRole(membership?.role || null)
          }
        }
      } else {
        setUser(null)
        setOrgs([])
        setCurrentOrg(null)
        setUserRole(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [setUser, setLoading, setCurrentOrg, setOrgs, setUserRole])

  const signIn = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !auth) {
      // Local Auth Fallback
      const users = localDb.getUsers()
      const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase())
      
      if (!foundUser) {
        throw new Error('User not found. Use "owner@retailbot.co" / "password" for local testing.')
      }
      
      // Standard password mock check (accepts "password" or anything for demo, but let's check for "password")
      if (password !== 'password') {
        throw new Error('Invalid password. Default password is "password" for seed users.')
      }

      localStorage.setItem('retail_copilot_session_uid', foundUser.id)
      setUser(foundUser)

      // Fetch local orgs
      const memberships = localDb.getOrgMemberships(foundUser.id)
      const allOrgs = localDb.getOrgs()
      const userOrgs = allOrgs.filter(org => memberships.some(m => m.orgId === org.id))
      setOrgs(userOrgs)

      if (userOrgs.length > 0) {
        setCurrentOrg(userOrgs[0])
        const activeMembership = memberships.find(m => m.orgId === userOrgs[0].id)
        setUserRole(activeMembership?.role || 'owner')
      }
      return
    }

    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (email: string, password: string, displayName: string) => {
    if (!isFirebaseConfigured || !auth) {
      // Local Auth Signup Fallback
      const users = localDb.getUsers()
      const exists = users.some(u => u.email.toLowerCase() === email.toLowerCase())
      if (exists) {
        throw new Error('User with this email already exists.')
      }

      const newUser: User = {
        id: `user_${Date.now()}`,
        email,
        displayName,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      localDb.saveUser(newUser)
      localStorage.setItem('retail_copilot_session_uid', newUser.id)
      setUser(newUser)
      setOrgs([])
      setCurrentOrg(null)
      setUserRole(null)
      return
    }

    const result = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(result.user, { displayName })
  }

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth) {
      // Mock Google sign in
      const mockUser: User = {
        id: 'google_user_123',
        email: 'googleowner@gmail.com',
        displayName: 'Google Demo User',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Check if user exists, else save
      const users = localDb.getUsers()
      if (!users.some(u => u.id === mockUser.id)) {
        localDb.saveUser(mockUser)
      }

      localStorage.setItem('retail_copilot_session_uid', mockUser.id)
      setUser(mockUser)

      // Rest of Google login setup
      const memberships = localDb.getOrgMemberships(mockUser.id)
      const allOrgs = localDb.getOrgs()
      const userOrgs = allOrgs.filter(org => memberships.some(m => m.orgId === org.id))
      setOrgs(userOrgs)

      if (userOrgs.length > 0) {
        setCurrentOrg(userOrgs[0])
        const activeMembership = memberships.find(m => m.orgId === userOrgs[0].id)
        setUserRole(activeMembership?.role || 'owner')
      } else {
        // Auto create org for google users
        const newOrg = localDb.createOrg('My Retail Shop', mockUser.id)
        setOrgs([newOrg])
        setCurrentOrg(newOrg)
        setUserRole('owner')
      }
      return
    }

    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  const signOut = async () => {
    if (!isFirebaseConfigured || !auth) {
      localStorage.removeItem('retail_copilot_session_uid')
      setUser(null)
      setOrgs([])
      setCurrentOrg(null)
      setUserRole(null)
      return
    }

    await firebaseSignOut(auth)
  }

  const createOrganization = async (name: string): Promise<Organization> => {
    if (!user) throw new Error('User must be authenticated')
    
    if (!isFirebaseConfigured || !db) {
      // Local Org Creation Fallback
      const newOrg = localDb.createOrg(name, user.id)
      setOrgs([...useOrgStore.getState().orgs, newOrg])
      setCurrentOrg(newOrg)
      setUserRole('owner')
      return newOrg
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const orgRef = doc(collection(db, 'organizations'))
    
    const org: Omit<Organization, 'id'> = {
      name,
      slug,
      ownerId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        currency: 'INR',
        taxRate: 18,
        lowStockThreshold: 15,
        deadStockDays: 45,
      },
    }

    await setDoc(orgRef, {
      ...org,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // Create owner membership
    const memberRef = doc(collection(db, 'org_members'))
    await setDoc(memberRef, {
      orgId: orgRef.id,
      userId: user.id,
      role: 'owner',
      joinedAt: serverTimestamp(),
    })

    const newOrg = { ...org, id: orgRef.id }
    setOrgs([...useOrgStore.getState().orgs, newOrg])
    setCurrentOrg(newOrg)
    setUserRole('owner')

    return newOrg
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        createOrganization,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
