'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/0_Bruddle/Button'
import { type MigrationSurface } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { onStoreAnchorClick, storeAnchorHref } from '@/utils/migration.utils'
import type { LandingMigrationStrings } from './landingStrings'

/**
 * Phone download CTA during the migration window: one full-width white button
 * and nothing that can wrap. A two-button store row is what overflows at
 * 320px, so the second store is a text link to /app, which sends whichever
 * phone follows it to the right store.
 *
 * The href starts as `/app` and is upgraded to the store deep link in an
 * effect: /app is a working smart link on its own, so a tap that lands before
 * the device is detected (or with the hand-off payload still unbuilt) still
 * reaches a store instead of a dead anchor.
 *
 * Copy comes in as a prop rather than from `useTranslations`: this renders on
 * /es-419, /es-ar and /pt-br, and next-intl resolves the DEVICE locale, not the
 * route's.
 */
export function PhoneAppCta({
    surface,
    strings,
    subtext,
    showOtherStore = false,
}: {
    surface: MigrationSurface
    strings: LandingMigrationStrings
    subtext?: string
    showOtherStore?: boolean
}) {
    const { deviceType } = useDeviceType()
    const store = deviceType === DeviceType.ANDROID ? 'android' : 'ios'
    const [href, setHref] = useState('/app')

    useEffect(() => {
        setHref(storeAnchorHref(store))
    }, [store])

    return (
        <div data-testid="phone-app-cta" className="flex w-full flex-col items-center gap-2">
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full"
                onClick={() => onStoreAnchorClick(store, surface)}
            >
                <Button
                    shadowSize="4"
                    icon={store === 'ios' ? 'apple-logo' : 'google-play'}
                    className="w-full bg-white px-7 text-base font-extrabold uppercase hover:bg-white/90"
                >
                    {strings.downloadNow}
                </Button>
            </a>
            {showOtherStore && (
                <Link prefetch={false} href="/app" className="block text-center text-body-s text-n-1 underline">
                    {strings.otherStore}
                </Link>
            )}
            {subtext && <span className="block text-center text-sm text-n-1 italic">{subtext}</span>}
        </div>
    )
}
