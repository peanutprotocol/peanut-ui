'use client'

// smart store link: peanut.me/app — every download QR points here so a single
// code serves both stores; the scanning device decides. phones bounce straight
// to their store (their store button carries the loading state while the
// redirect happens; if it doesn't take, the buttons settle clickable),
// desktop just gets both buttons. client redirect (not a route handler) so
// the capacitor static export builds unchanged. same visual language as the
// sunset screen (MigrationHero + 50/50 split).
//
// flag-gated like every migration surface: until the pwa-sunset flag resolves
// ON this page 404s — otherwise merging would put a live public page with
// dead store links on peanut.me. posthog flags arrive async for first-time
// visitors, so we wait for the flag callback (or a short timeout when posthog
// is blocked) before deciding page-vs-404.
//
// hydration: SSR and the first client render show the same neutral loading
// state (mounted guard) — deriving the redirect state from useDeviceType at
// first render tripped React #418 on phones (device is WEB on the server).

import { useEffect, useState } from 'react'
import { notFound, useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import Loading from '@/components/Global/Loading'
import MigrationHero from '@/components/Migration/MigrationHero'
import { STORE_NAME, STORE_URL, type StoreKind } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { isNativeBridge } from '@/utils/capacitor'
import { isPwaSunsetOn } from '@/utils/migration.utils'

const FLAG_WAIT_MS = 4000

export default function SmartStoreRedirect() {
    const t = useTranslations('migration')
    const { deviceType } = useDeviceType()
    const router = useRouter()

    // universal links (paths: ["*"]) open this page inside the native app when
    // an installed user scans a download qr — there's no store to bounce to,
    // so send them home instead of redirecting them out to the store.
    // isNativeBridge, not isCapacitor: capacitor-flavored web builds bake
    // NEXT_PUBLIC_CAPACITOR_BUILD=true with no bridge, and those visitors
    // still need the store page.
    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        setMounted(true)
        if (isNativeBridge()) router.replace('/home')
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

    const [redirecting, setRedirecting] = useState(false)
    useEffect(() => {
        if (inNativeApp || !settled || !migrationOn || !targetStore) return
        setRedirecting(true)
        window.location.replace(STORE_URL[targetStore])
        // if the store didn't take over (blocked, offline), settle to buttons
        const fallback = setTimeout(() => setRedirecting(false), 4000)
        return () => clearTimeout(fallback)
    }, [inNativeApp, settled, migrationOn, targetStore])

    if (inNativeApp) return <Loading variant="mascot" coverFullScreen />

    if (settled && !migrationOn) notFound()

    const stores: StoreKind[] = targetStore
        ? [targetStore, targetStore === 'ios' ? 'android' : 'ios']
        : ['ios', 'android']

    return (
        <div className="flex min-h-[100dvh] w-full flex-col bg-white md:flex-row">
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
                            <a key={s} href={STORE_URL[s]} className={redirecting && i > 0 ? 'hidden' : 'block'}>
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
