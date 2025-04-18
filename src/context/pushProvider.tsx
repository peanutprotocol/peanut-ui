'use client'

import { sendNotification, subscribeUser } from '@/app/actions'
import { useToast } from '@/components/0_Bruddle/Toast'
import { urlBase64ToUint8Array } from '@/utils'
import { captureException } from '@sentry/nextjs'
import React, { createContext, useContext, useEffect, useState } from 'react'
import webpush from 'web-push'
import { useAuth } from './authContext'

interface PushContextType {
    subscribe: () => Promise<void>
    unsubscribe: () => void
    isSupported: boolean
    isSubscribing: boolean
    isSubscribed: boolean
    send: ({ message, title }: { message: string; title: string }) => void
}

const PushContext = createContext<PushContextType | undefined>(undefined)

export function PushProvider({ children }: { children: React.ReactNode }) {
    const toast = useToast()
    const { userId } = useAuth()
    const [isSupported, setIsSupported] = useState(false)
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [isSubscribing, setIsSubscribing] = useState(false)
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
    const [subscription, setSubscription] = useState<webpush.PushSubscription | null>(null)

    const registerServiceWorker = async () => {
        console.log('Registering service worker')
        try {
            const reg = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
                updateViaCache: 'none',
            })
            console.log({ reg })
            setRegistration(reg)
            const sub = await reg.pushManager.getSubscription()

            console.log({ sub })

            if (sub) {
                // @ts-ignore
                setSubscription(sub)
                setIsSubscribed(true)
            }
        } catch (error) {
            console.error('Service Worker registration failed:', error)
            captureException(error)
        }
    }

    useEffect(() => {
        console.log('Checking for service worker and push manager')
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            console.log('Service Worker and Push Manager are supported')
            setIsSupported(true)
            // Wait for service worker to be ready
            navigator.serviceWorker.ready
                .then(() => {
                    registerServiceWorker()
                })
                .catch((error) => {
                    console.error('Service Worker not ready:', error)
                    captureException(error)
                    toast.error('Failed to initialize notifications')
                })
        } else {
            console.log('Service Worker and Push Manager are not supported')
            setIsSupported(false)
        }
    }, [])

    const subscribe = async (): Promise<void> => {
        if (!registration) {
            toast.error('Something went wrong while initializing notifications')
            return
        } else if (!userId) {
            toast.error('Something went wrong while initializing notifications')
            return
        }

        setIsSubscribing(true)
        try {
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
            })

            // @ts-ignore
            setSubscription(sub)

            const plainSub = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: Buffer.from((sub as any).getKey('p256dh')).toString('base64'),
                    auth: Buffer.from((sub as any).getKey('auth')).toString('base64'),
                },
            }

            await subscribeUser(userId, plainSub)

            setIsSubscribed(true)
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.log(error.message)
                if (error.message.includes('permission denied')) {
                    toast.error('Please allow notifications in your browser settings')
                } else {
                    toast.error('Failed to enable notifications')
                    captureException(error)
                }
                console.error('Error subscribing to push notifications:', error.message)
            } else {
                throw error
            }
        }
        setIsSubscribing(false)
    }
    const unsubscribe = async () => {}

    const send = async ({ message, title }: { message: string; title: string }) => {
        const plainSub = {
            endpoint: subscription!.endpoint,
            keys: {
                p256dh: Buffer.from((subscription as any).getKey('p256dh')).toString('base64'),
                auth: Buffer.from((subscription as any).getKey('auth')).toString('base64'),
            },
        }

        await sendNotification(plainSub, { message, title })
    }

    return (
        <PushContext.Provider
            value={{
                subscribe,
                unsubscribe,
                isSupported,
                isSubscribing,
                isSubscribed,
                send,
            }}
        >
            {children}
        </PushContext.Provider>
    )
}

export function usePush() {
    const context = useContext(PushContext)
    if (context === undefined) {
        throw new Error('usePush must be used within a PushProvider')
    }
    return context
}
