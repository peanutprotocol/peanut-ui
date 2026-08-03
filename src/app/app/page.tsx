'use client'

// smart store link: peanut.me/app — every download QR points here so a single
// code serves both stores; the scanning device decides. phones bounce straight
// to their store (their store button shows the loading state while the
// redirect happens; if it doesn't take, the buttons settle clickable),
// desktop just gets both buttons. client redirect (not a route handler) so
// the capacitor static export builds unchanged. same visual language as the
// sunset screen (MigrationHero + 50/50 split).

import { useEffect, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import MigrationHero from '@/components/Migration/MigrationHero'
import { STORE_NAME, STORE_URL, type StoreKind } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'

export default function SmartStoreRedirect() {
    const { deviceType } = useDeviceType()
    const targetStore: StoreKind | null =
        deviceType === DeviceType.IOS ? 'ios' : deviceType === DeviceType.ANDROID ? 'android' : null
    const [redirecting, setRedirecting] = useState(targetStore !== null)

    useEffect(() => {
        if (!targetStore) return
        window.location.replace(STORE_URL[targetStore])
        // if the store didn't take over (blocked, offline), settle to buttons
        const fallback = setTimeout(() => setRedirecting(false), 4000)
        return () => clearTimeout(fallback)
    }, [targetStore])

    const stores: StoreKind[] = targetStore
        ? [targetStore, targetStore === 'ios' ? 'android' : 'ios']
        : ['ios', 'android']

    return (
        <div className="flex min-h-[100dvh] w-full flex-col bg-white md:flex-row">
            <MigrationHero className="h-[50dvh] md:h-auto md:w-1/2" />
            <section className="flex flex-1 flex-col justify-between p-6 pb-[calc(1.5rem_+_env(safe-area-inset-bottom))] md:w-1/2 md:justify-center md:gap-10">
                <div className="mx-auto flex w-full max-w-md flex-col gap-3 md:text-center">
                    <h1 className="text-3xl font-bold text-n-1">Get the Peanut app</h1>
                    <p className="text-base text-grey-1">
                        {redirecting
                            ? 'Taking you to the store…'
                            : 'Global cash, local feel — pick your store to download.'}
                    </p>
                </div>
                <div className="mx-auto flex w-full max-w-md flex-col gap-4">
                    {stores.map((s, i) => (
                        <a key={s} href={STORE_URL[s]} className={redirecting && i > 0 ? 'hidden' : 'block'}>
                            <Button
                                variant={i === 0 ? 'purple' : 'stroke'}
                                shadowSize="4"
                                icon={redirecting ? undefined : 'mobile-install'}
                                className="w-full"
                                loading={redirecting && i === 0}
                                disabled={redirecting && i === 0}
                            >
                                {STORE_NAME[s]}
                            </Button>
                        </a>
                    ))}
                </div>
            </section>
        </div>
    )
}
