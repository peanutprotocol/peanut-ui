'use client'

// smart store link: peanut.me/app — every download QR points here so a single
// code serves both stores; the scanning device decides. phones bounce straight
// to their store, desktop gets both links. client redirect (not a route
// handler) so the capacitor static export builds unchanged.

import { useEffect, useState } from 'react'
import { STORE_URL } from '@/constants/migration.consts'
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
        <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center gap-4 bg-white p-6">
            <h1 className="text-2xl font-bold text-n-1">Get the Peanut app</h1>
            {redirecting ? (
                <p className="text-sm text-grey-1">Taking you to the store…</p>
            ) : (
                <div className="flex items-center gap-6">
                    <a href={STORE_URL.ios} className="text-black underline">
                        App Store
                    </a>
                    <a href={STORE_URL.android} className="text-black underline">
                        Google Play
                    </a>
                </div>
            )}
        </div>
    )
}
