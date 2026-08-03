'use client'

// smart store link: peanut.me/app — every download QR points here so a single
// code serves both stores; the scanning device decides. phones bounce straight
// to their store, desktop gets both store buttons. client redirect (not a
// route handler) so the capacitor static export builds unchanged. same visual
// language as the sunset screen (MigrationHero + 50/50 split).

import { useEffect, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import Loading from '@/components/Global/Loading'
import MigrationHero from '@/components/Migration/MigrationHero'
import { STORE_NAME, STORE_URL } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'

export default function SmartStoreRedirect() {
    const { deviceType } = useDeviceType()
    const [redirecting, setRedirecting] = useState(true)

    useEffect(() => {
        if (deviceType === DeviceType.IOS) {
            window.location.replace(STORE_URL.ios)
        } else if (deviceType === DeviceType.ANDROID) {
            window.location.replace(STORE_URL.android)
        } else {
            setRedirecting(false)
        }
    }, [deviceType])

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
                    {redirecting ? (
                        <div className="flex justify-center py-2">
                            <Loading />
                        </div>
                    ) : (
                        <>
                            <a href={STORE_URL.ios} className="block">
                                <Button variant="purple" shadowSize="4" icon="mobile-install" className="w-full">
                                    {STORE_NAME.ios}
                                </Button>
                            </a>
                            <a href={STORE_URL.android} className="block">
                                <Button variant="stroke" shadowSize="4" icon="mobile-install" className="w-full">
                                    {STORE_NAME.android}
                                </Button>
                            </a>
                        </>
                    )}
                </div>
            </section>
        </div>
    )
}
