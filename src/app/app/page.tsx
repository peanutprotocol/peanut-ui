'use client'

// QR destination shared by both stores. Client-side routing also works in the native static export.

import { useCallback, useEffect, useRef, useState } from 'react'
import { notFound, useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import Loading from '@/components/Global/Loading'
import PeanutLoading from '@/components/Global/PeanutLoading'
import MigrationHero from '@/components/Migration/MigrationHero'
import { MIGRATION_SURFACES, STORE_NAME, STORE_URL, type StoreKind } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { isNativeBridge } from '@/utils/capacitor'
import {
    applyDeferredPayload,
    copyIOSHandoff,
    parseDeferredPayload,
    playStoreUrlWithReferrer,
    trackDeferredHandoffCreated,
} from '@/utils/deferred-link'
import { isPwaSunsetOn, trackStoreClick } from '@/utils/migration.utils'

const FLAG_WAIT_MS = 4000

export default function SmartStoreRedirect() {
    const t = useTranslations('migration')
    const { deviceType } = useDeviceType()
    const router = useRouter()

    // Keep SSR and the first client render identical; device and URL context are browser-only.
    const [mounted, setMounted] = useState(false)
    const [payload, setPayload] = useState<string | null>(null)
    useEffect(() => {
        setMounted(true)
        const search = window.location.search
        const parsed = parseDeferredPayload(search)
        if (parsed) setPayload(new URLSearchParams(search).toString())
        // A native-flavored web build can lack the bridge and still need the store page.
        if (!isNativeBridge()) return
        // Installed apps apply the QR's context immediately, then open its destination.
        const dest = parsed ? applyDeferredPayload(parsed).dest : null
        router.replace(dest ?? '/home')
    }, [router])
    const inNativeApp = mounted && isNativeBridge()

    // Wait for PostHog before returning 404. The timeout also handles blocked analytics.
    const [flagsSettled, setFlagsSettled] = useState(false)
    useEffect(() => {
        if (isNativeBridge()) return
        if (isPwaSunsetOn()) {
            setFlagsSettled(true)
            return
        }
        const unsubscribe = posthog.onFeatureFlags(() => setFlagsSettled(true))
        const timeout = setTimeout(() => setFlagsSettled(true), FLAG_WAIT_MS)
        return () => {
            unsubscribe?.()
            clearTimeout(timeout)
        }
    }, [])

    const migrationOn = mounted && isPwaSunsetOn()
    const settled = mounted && flagsSettled

    const targetStore: StoreKind | null = !mounted
        ? null
        : deviceType === DeviceType.IOS
          ? 'ios'
          : deviceType === DeviceType.ANDROID
            ? 'android'
            : null

    const storeHref = useCallback(
        (store: StoreKind) => (payload && store === 'android' ? playStoreUrlWithReferrer(payload) : STORE_URL[store]),
        [payload]
    )

    // Count the automatic redirect and any fallback taps as one handoff per visit.
    const handoffCounted = useRef(false)
    const countHandoff = useCallback((platform: StoreKind) => {
        if (handoffCounted.current) return
        handoffCounted.current = true
        trackDeferredHandoffCreated(platform)
    }, [])

    // Start the clipboard write inside the tap handler to preserve the browser's user gesture.
    const onStoreTap = (store: StoreKind) => {
        trackStoreClick(store, MIGRATION_SURFACES.SMART_LINK, !!payload)
        if (!payload) return
        if (store === 'android') {
            countHandoff('android')
            return
        }
        void copyIOSHandoff(payload)
            .then(() => countHandoff('ios'))
            .catch(() => {})
    }

    const [redirecting, setRedirecting] = useState(false)
    useEffect(() => {
        if (inNativeApp || !settled || !migrationOn || !targetStore) return
        // iOS payloads need a clipboard write on tap. Android carries its payload in the URL.
        if (payload && targetStore === 'ios') return
        if (payload && targetStore === 'android') countHandoff('android')
        setRedirecting(true)
        window.location.replace(storeHref(targetStore))
        // Restore clickable buttons if the store does not open.
        const fallback = setTimeout(() => setRedirecting(false), 4000)
        return () => clearTimeout(fallback)
    }, [inNativeApp, settled, migrationOn, targetStore, payload, storeHref, countHandoff])

    if (inNativeApp) return <PeanutLoading coverFullScreen />

    if (settled && !migrationOn) notFound()

    const stores: StoreKind[] = targetStore
        ? [targetStore, targetStore === 'ios' ? 'android' : 'ios']
        : ['ios', 'android']

    return (
        <div className="flex min-h-[100dvh] w-full flex-col bg-white md:flex-row">
            <MigrationHero className="h-[50dvh] md:h-auto md:w-1/2" />
            <section className="flex flex-1 flex-col justify-between p-6 pb-[calc(1.5rem_+_env(safe-area-inset-bottom))] md:w-1/2 md:justify-center md:gap-10">
                <div className="mx-auto flex w-full max-w-md flex-col gap-3 md:text-center">
                    <h1 className="text-3xl font-bold text-n-1">{t('qr.title')}</h1>
                    {settled && migrationOn && (
                        <p className="text-base text-grey-1">
                            {redirecting ? t('smartLink.redirecting') : t('smartLink.pickStore')}
                        </p>
                    )}
                </div>
                <div className="mx-auto flex w-full max-w-md flex-col gap-4">
                    {settled && migrationOn ? (
                        stores.map((s, i) => (
                            <a
                                key={s}
                                href={storeHref(s)}
                                onClick={() => onStoreTap(s)}
                                className={redirecting && i > 0 ? 'hidden' : 'block'}
                            >
                                <Button
                                    variant={i === 0 ? 'purple' : 'stroke'}
                                    shadowSize="4"
                                    icon={redirecting ? undefined : s === 'ios' ? 'apple-logo' : 'google-play'}
                                    className="w-full"
                                    loading={redirecting && i === 0}
                                    disabled={redirecting && i === 0}
                                >
                                    {STORE_NAME[s]}
                                </Button>
                            </a>
                        ))
                    ) : (
                        <div className="flex justify-center py-2">
                            <Loading />
                        </div>
                    )}
                </div>
            </section>
        </div>
    )
}
