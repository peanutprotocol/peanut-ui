'use client'

// QR destination shared by both stores. Client-side routing also works in the native static export.

import { useNativePlatform } from '@/utils/native-platform'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseAsString, useQueryStates } from 'nuqs'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import Loading from '@/components/Global/Loading'
import MigrationHero from '@/components/Migration/MigrationHero'
import { MIGRATION_SURFACES, STORE_NAME, STORE_URL, type StoreKind } from '@/constants/migration.consts'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import { isNativeBridge, openExternalUrl } from '@/utils/capacitor'
import { twMerge } from '@/utils/tw'
import {
    applyDeferredPayload,
    buildDeferredPayload,
    MAX_PLAY_REFERRER_LENGTH,
    copyIOSHandoff,
    parseDeferredPayload,
    playStoreUrlWithReferrer,
    trackDeferredHandoffCreated,
} from '@/utils/deferred-link'
import { storeForDevice, storeIcon, trackStoreClick } from '@/utils/migration.utils'
import { captureSignupAttribution, hasMarketingTouch } from '@/utils/signup-attribution'
import { parseMarketingQrHandoff } from '@/features/marketing-qr/contract'
import { marketingQrAnalyticsAllowed } from '@/features/marketing-qr/consent'

import {
    bootstrapTrackedLinkEntry,
    hasTrackedLinkEntry,
    type TrackedLinkBootstrap,
} from '@/features/tracked-links/bootstrap'
import { isInviteUsername, TRACKED_LINK_ORIGIN } from '@/features/tracked-links/contract'

// '/' sends no destination, so a new install opens to its normal first screen.
const AD_ENTRY_DEST = '/'

export default function SmartStoreRedirect() {
    return (
        <Suspense fallback={<Loading variant="mascot" coverFullScreen />}>
            <SmartStoreContent />
        </Suspense>
    )
}

function SmartStoreContent() {
    const nativePlatform = useNativePlatform()

    const t = useTranslations('migration')
    const { deviceType } = useDeviceType()
    const router = useRouter()
    const [entryQuery] = useQueryStates({
        tl: parseAsString,
        tr: parseAsString,
        tracked_link: parseAsString,
        code: parseAsString,
        tl_seen: parseAsString,
        pnutdl: parseAsString,
    })
    const entryKey = JSON.stringify(entryQuery)
    const trackedEntry =
        entryQuery.tl !== null || entryQuery.tracked_link !== null || isInviteUsername(entryQuery.code?.toLowerCase())

    // Keep SSR and the first client render identical; device and URL context are browser-only.
    const [mounted, setMounted] = useState(false)
    const [payload, setPayload] = useState<string | null>(null)
    const [iosPayload, setIosPayload] = useState<string | null>(null)
    const [entryReady, setEntryReady] = useState(false)
    const [openAppHref, setOpenAppHref] = useState<string | null>(null)
    const bootstrap = useRef<{
        key: string
        promise: Promise<TrackedLinkBootstrap>
        controller: AbortController
    } | null>(null)
    useEffect(() => {
        setMounted(true)
        const search = window.location.search
        const params = new URLSearchParams(search)
        if (hasTrackedLinkEntry(params)) {
            let disposed = false
            let timeout: ReturnType<typeof setTimeout> | undefined
            setEntryReady(false)
            setPayload(null)
            setIosPayload(null)
            setOpenAppHref(null)
            const doc = document as Document & { prerendering?: boolean }
            const start = () => {
                if (doc.prerendering) return
                const native = isNativeBridge()
                const key = `${native}:${search}`
                if (bootstrap.current?.key !== key) {
                    bootstrap.current?.controller.abort()
                    const controller = new AbortController()
                    bootstrap.current = {
                        key,
                        controller,
                        promise: bootstrapTrackedLinkEntry(params, native, controller.signal),
                    }
                }
                const activeBootstrap = bootstrap.current
                const fallback = new Promise<TrackedLinkBootstrap>((resolve) => {
                    timeout = setTimeout(() => {
                        activeBootstrap.controller.abort()
                        resolve({ payload: null, iosPayload: null })
                    }, 3000)
                })
                void Promise.race([activeBootstrap.promise, fallback])
                    .catch(() => ({ payload: null, iosPayload: null }) as TrackedLinkBootstrap)
                    .then((entry) => {
                        if (timeout) clearTimeout(timeout)
                        if (disposed) return
                        setPayload(entry.payload)
                        setIosPayload(entry.iosPayload)
                        setOpenAppHref(entry.openAppHref ?? null)
                        if (native) {
                            if (entry.publicPageHref)
                                void openExternalUrl(`${TRACKED_LINK_ORIGIN}${entry.publicPageHref}`).catch(() => {})
                            router.replace('/home')
                        } else if (entry.publicPageHref) {
                            window.location.replace(entry.publicPageHref)
                            return
                        }
                        setEntryReady(true)
                    })
            }
            if (doc.prerendering) doc.addEventListener('prerenderingchange', start, { once: true })
            else start()
            return () => {
                disposed = true
                if (timeout) clearTimeout(timeout)
                doc.removeEventListener('prerenderingchange', start)
            }
        }
        bootstrap.current?.controller.abort()
        bootstrap.current = null
        setPayload(null)
        setIosPayload(null)
        setOpenAppHref(null)
        setEntryReady(true)
        const parsed = parseDeferredPayload(search)
        const marketing = parseMarketingQrHandoff(new URLSearchParams(search))
        if (marketing && !isNativeBridge()) {
            if (marketing.analyticsAllowed && marketingQrAnalyticsAllowed()) {
                try {
                    captureSignupAttribution()
                    const makePayload = (store: 'android' | 'ios') => {
                        const params = new URLSearchParams(
                            buildDeferredPayload(marketing.registration.continuation, undefined, store, {
                                includeInviteAndBadgeContext: false,
                            })
                        )
                        params.set('lang', marketing.registration.locale)
                        if (
                            store === 'android' &&
                            encodeURIComponent(params.toString()).length > MAX_PLAY_REFERRER_LENGTH
                        ) {
                            params.delete('lang')
                        }
                        return params.toString()
                    }
                    setPayload(makePayload('android'))
                    setIosPayload(makePayload('ios'))
                } catch {
                    // Registered QR links still offer the stores when a handoff cannot be built.
                }
            }
        } else if (parsed) setPayload(new URLSearchParams(search).toString())
        else if (!isNativeBridge() && marketingQrAnalyticsAllowed() && hasMarketingTouch()) {
            // Without a hand-off, an ad campaign in utm_* never reaches the installed app.
            try {
                if (captureSignupAttribution()) {
                    setPayload(buildDeferredPayload(AD_ENTRY_DEST, undefined, 'android'))
                    setIosPayload(buildDeferredPayload(AD_ENTRY_DEST, undefined, 'ios'))
                }
            } catch {
                // The stores stay reachable without a hand-off.
            }
        }
        // A native-flavored web build can lack the bridge and still need the store page.
        if (!isNativeBridge()) return
        // Installed apps apply the QR's context immediately, then open its destination.
        const dest = parsed ? applyDeferredPayload(parsed).dest : null
        router.replace(dest ?? '/home')
        return undefined
    }, [router, entryKey])
    const inNativeApp = mounted && nativePlatform.isNativeBridge

    const targetStore: StoreKind | null = mounted ? storeForDevice(deviceType) : null

    const storeHref = useCallback(
        (store: StoreKind) => (payload && store === 'android' ? playStoreUrlWithReferrer(payload) : STORE_URL[store]),
        [payload]
    )

    // Count the automatic redirect and any fallback taps as one handoff per visit.
    const handoffCounted = useRef(false)
    const countHandoff = useCallback(
        (platform: StoreKind) => {
            if (trackedEntry && !marketingQrAnalyticsAllowed()) return
            if (handoffCounted.current) return
            handoffCounted.current = true
            trackDeferredHandoffCreated(platform)
        },
        [trackedEntry]
    )

    // Start the clipboard write inside the tap handler to preserve the browser's user gesture.
    const onStoreTap = (store: StoreKind) => {
        if (!trackedEntry || marketingQrAnalyticsAllowed())
            trackStoreClick(store, MIGRATION_SURFACES.SMART_LINK, !!payload)
        const handoff = store === 'ios' ? (iosPayload ?? payload) : payload
        if (!handoff) return
        if (store === 'android') {
            countHandoff('android')
            return
        }
        void copyIOSHandoff(handoff)
            .then(() => countHandoff('ios'))
            .catch(() => {})
    }

    const [redirecting, setRedirecting] = useState(false)
    useEffect(() => {
        if (!entryReady || inNativeApp || !targetStore) return
        // iOS payloads need a clipboard write on tap. Android carries its payload in the URL.
        if (payload && targetStore === 'ios') return
        if (payload && targetStore === 'android') countHandoff('android')
        setRedirecting(true)
        window.location.replace(storeHref(targetStore))
        // Restore clickable buttons if the store does not open.
        const fallback = setTimeout(() => setRedirecting(false), 4000)
        return () => clearTimeout(fallback)
    }, [entryReady, inNativeApp, targetStore, payload, storeHref, countHandoff])

    if (inNativeApp) return <Loading variant="mascot" coverFullScreen />

    const stores: StoreKind[] = targetStore
        ? [targetStore, targetStore === 'ios' ? 'android' : 'ios']
        : ['ios', 'android']

    return (
        <div className="flex min-h-dvh w-full flex-col bg-white md:flex-row">
            <MigrationHero className="h-[50dvh] md:h-auto md:w-1/2" />
            <section className="flex flex-1 flex-col justify-between p-6 pb-[calc(1.5rem_+_var(--safe-bottom))] md:w-1/2 md:justify-center md:gap-10">
                <div className="mx-auto flex w-full max-w-md flex-col gap-3 md:text-center">
                    <h1 className="text-heading-m text-foreground-primary">{t('qr.title')}</h1>
                    {mounted && (
                        <p className="text-body-m text-foreground-secondary">
                            {redirecting ? t('smartLink.redirecting') : t('smartLink.pickStore')}
                        </p>
                    )}
                </div>
                <div className="mx-auto flex w-full max-w-md flex-col gap-4 md:max-w-xs">
                    {entryReady && openAppHref && !redirecting && (
                        <Button variant="secondary" href={openAppHref} plainAnchor className="w-full">
                            {t('smartLink.openApp')}
                        </Button>
                    )}
                    {mounted && entryReady ? (
                        stores.map((s, i) => (
                            <Button
                                key={s}
                                variant={i === 0 ? 'primary' : 'secondary'}
                                shadowSize="4"
                                icon={redirecting ? undefined : storeIcon(s)}
                                className={twMerge('w-full', redirecting && i > 0 && 'hidden')}
                                loading={redirecting && i === 0}
                                disabled={redirecting && i === 0}
                                onClick={() => {
                                    onStoreTap(s)
                                    window.location.assign(storeHref(s))
                                }}
                            >
                                {STORE_NAME[s]}
                            </Button>
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
