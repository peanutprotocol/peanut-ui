'use client'

import '@khmyznikov/pwa-install'
import { PWAInstallElement } from '@khmyznikov/pwa-install'
import { track } from '@vercel/analytics'
import { useRef, useEffect, useCallback, useMemo } from 'react'

type PWAInstallProps = {
    name?: string
    description?: string
    icon: string
    'manual-apple': 'true' | 'false'
    'manual-chrome': 'true' | 'false'
    'install-description': string
}

export function PWAInstaller({ ...props }: PWAInstallProps) {
    return <pwa-install id={`pwa-install`} {...props}></pwa-install>
}

export type PWAInstallerMethodsType = PWAInstallElement & {
    isListening?: boolean
}

export function usePWAInstaller() {
    const installerRef = useRef<PWAInstallerMethodsType | null>(null)

    useEffect(() => {
        const element = document.getElementById('pwa-install') as unknown as PWAInstallerMethodsType
        if (element) {
            installerRef.current = element
        }
    }, [])

    const eventHandlers = useMemo(
        () => [
            {
                name: 'pwa-install-success-event',
                handler: (e: Event) => {
                    track('pwa-install-success-event')
                },
            },
            {
                name: 'pwa-install-fail-event',
                handler: (e: Event) => {
                    track('pwa-install-fail-event')
                },
            },
            {
                name: 'pwa-install-available-event',
                handler: (e: Event) => console.log('[installer] installation available:', e),
            },
            {
                name: 'pwa-user-choice-result-event',
                handler: (e: Event) => console.log('[installer] user choice result:', e),
            },
            {
                name: 'pwa-install-how-to-event',
                handler: (e: Event) => console.log('[installer] installation how to:', e),
            },
            {
                name: 'pwa-install-gallery-event',
                handler: (e: Event) => console.log('[installer] installation gallery:', e),
            },
        ],
        []
    )

    const install = useCallback(
        (force?: boolean) => {
            if (!installerRef.current) {
                console.warn('[installer] PWA install element not found')
                return
            }

            installerRef.current.showDialog(force)
            console.log(`[installer] ${force ? 'forced' : 'prompted'} installation to:`, installerRef.current)

            if (!installerRef.current.isListening) {
                installerRef.current.isListening = true

                eventHandlers.forEach(({ name, handler }) => {
                    installerRef.current?.addEventListener(name, handler)
                })
            }
        },
        [eventHandlers]
    )

    return { install }
}
