'use client'

// smart store link: peanut.me/app — every download QR points here so a single
// code serves both stores; the scanning device decides. phones bounce straight
// to their store (their store button carries the loading state while the
// redirect happens; if it doesn't take, the buttons settle clickable),
// desktop just gets both buttons. client redirect (not a route handler) so
// the capacitor static export builds unchanged. same visual language as the
// sunset screen (MigrationHero + 50/50 split).
//
// deferred context: the QR that produced the scan can carry a payload
// (`?pnutdl=1&lang=…&invite=…&dest=…`, built by buildDeferredPayload on the
// desktop that rendered the QR). This page is where it changes hands:
//   android — rides the Play install referrer, so the auto-redirect can carry it
//   iOS     — rides the clipboard, which needs a user gesture, so there is NO
//             auto-redirect: the visitor taps App Store and the write happens
//             inside that tap handler
//   native  — the app itself opened this url (App Links claim /app), so there
//             is no store to bounce to: apply the payload and route to `dest`
// A bare /app (no marker) keeps today's behaviour exactly.
//
// flag-gated like every migration surface: until the pwa-sunset flag resolves
// ON this page 404s — otherwise merging would put a live public page with
// dead store links on peanut.me. posthog flags arrive async for first-time
// visitors, so we wait for the flag callback (or a short timeout when posthog
// is blocked) before deciding page-vs-404.
//
// hydration: SSR and the first client render show the same neutral loading
// state (mounted guard) — deriving the redirect state from useDeviceType at
// first render tripped React error 418 on phones (device is WEB on the server).

import { useCallback, useEffect, useRef, useState } from 'react'
import { notFound, useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import Loading from '@/components/Global/Loading'
import MigrationHero from '@/components/Migration/MigrationHero'
import {
    isMigrationSurface,
    MIGRATION_SURFACES,
    MIGRATION_SURFACE_PARAM,
    STORE_NAME,
    STORE_URL,
    type MigrationSurface,
    type StoreKind,
} from '@/constants/migration.consts'
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

/** the payload as it must be re-emitted, minus our own analytics tag */
function readHandoffPayload(search: string): string | null {
    if (!parseDeferredPayload(search)) return null
    const params = new URLSearchParams(search)
    params.delete(MIGRATION_SURFACE_PARAM)
    return params.toString()
}

export default function SmartStoreRedirect() {
    const t = useTranslations('migration')
    const { deviceType } = useDeviceType()
    const router = useRouter()

    // universal links (App Links claim /app) open this page inside the native
    // app when an installed user scans a download qr — there's no store to
    // bounce to, so apply whatever context the qr carried and route on.
    // isNativeBridge, not isCapacitor: capacitor-flavored web builds bake
    // NEXT_PUBLIC_CAPACITOR_BUILD=true with no bridge, and those visitors
    // still need the store page.
    const [mounted, setMounted] = useState(false)
    // read after mount, never during render: window.location.search does not
    // exist on the server and a payload-derived first render would not match
    const [payload, setPayload] = useState<string | null>(null)
    // the landing surface whose QR produced this scan (?s=). Reported as
    // `qr_surface` on this page's events — without it every smart_link click
    // looks the same and the hero / app fold / footer / rates QRs cannot be
    // told apart in the funnel. Validated against the known surfaces so a
    // hand-edited url can't inject a property value.
    const [qrSurface, setQrSurface] = useState<MigrationSurface | null>(null)
    useEffect(() => {
        setMounted(true)
        const search = window.location.search
        const parsed = parseDeferredPayload(search)
        const tag = new URLSearchParams(search).get(MIGRATION_SURFACE_PARAM)
        if (isMigrationSurface(tag)) setQrSurface(tag)
        if (parsed) setPayload(readHandoffPayload(search))
        if (!isNativeBridge()) return
        // already installed: no install to defer to, so apply the context now
        const dest = parsed ? applyDeferredPayload(parsed).dest : null
        router.replace(dest ?? '/home')
    }, [router])
    const inNativeApp = mounted && isNativeBridge()

    // wait for posthog to deliver flags (or time out) before judging the flag
    const [flagsSettled, setFlagsSettled] = useState(false)
    useEffect(() => {
        if (isNativeBridge()) return // redirecting home — flag irrelevant
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

    // DEFERRED_LINK_HANDOFF_CREATED is the denominator for
    // DEFERRED_LINK_RESTORED, so one visit must contribute at most one: the
    // auto-redirect fires it, and if the store intent never takes over
    // (blocked, offline, Play missing) the 4s fallback hands the visitor
    // clickable buttons that would fire it a second time.
    const handoffCounted = useRef(false)
    const countHandoff = (platform: 'ios' | 'android') => {
        if (handoffCounted.current) return
        handoffCounted.current = true
        trackDeferredHandoffCreated(platform, qrSurface ? { qr_surface: qrSurface } : undefined)
    }

    // must stay synchronous up to the clipboard call: a web clipboard write
    // only succeeds inside the user gesture that triggered it
    const onStoreTap = (store: StoreKind) => {
        trackStoreClick(store, MIGRATION_SURFACES.SMART_LINK, !!payload, qrSurface)
        if (!payload) return
        if (store === 'android') {
            // the referrer is already in the href — count the hand-off at the tap
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
        // iOS + payload: the clipboard hand-off needs the tap, so the visitor
        // picks the store themselves. android's referrer rides the url, so it
        // can still bounce; so can any device with nothing to hand off.
        if (payload && targetStore === 'ios') return
        // counted before the navigation, and only once per visit
        if (payload && targetStore === 'android') countHandoff('android')
        setRedirecting(true)
        window.location.replace(storeHref(targetStore))
        // if the store didn't take over (blocked, offline), settle to buttons
        const fallback = setTimeout(() => setRedirecting(false), 4000)
        return () => clearTimeout(fallback)
        // countHandoff is a stable ref-guarded closure over qrSurface; re-running
        // this effect on a qrSurface change would re-trigger the redirect
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inNativeApp, settled, migrationOn, targetStore, payload, storeHref])

    if (inNativeApp) return <Loading variant="mascot" coverFullScreen />

    if (settled && !migrationOn) notFound()

    const stores: StoreKind[] = targetStore
        ? [targetStore, targetStore === 'ios' ? 'android' : 'ios']
        : ['ios', 'android']

    return (
        <div className="flex min-h-dvh w-full flex-col bg-white md:flex-row">
            <MigrationHero className="h-[50dvh] md:h-auto md:w-1/2" />
            <section className="flex flex-1 flex-col justify-between p-6 pb-[calc(1.5rem_+_var(--safe-bottom))] md:w-1/2 md:justify-center md:gap-10">
                <div className="mx-auto flex w-full max-w-md flex-col gap-3 md:text-center">
                    <h1 className="text-heading-m text-foreground-primary">{t('qr.title')}</h1>
                    {settled && migrationOn && (
                        <p className="text-body-m text-foreground-secondary">
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
