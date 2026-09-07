'use client'

import dynamic from 'next/dynamic'
import StorePair from '@/components/Migration/StorePair'
import { PhoneAppCta } from './PhoneAppCta'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { AMBIENT_HANDOFF } from '@/utils/migration.utils'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import type { LandingMigrationStrings } from './landingStrings'

/**
 * The download block on top of the footer chrome, so every visitor who reaches
 * the bottom of the landing page still has the app in front of them.
 *
 * Dark-ground treatment: the store buttons keep the white fill and the black
 * border but drop the offset shadow, which is invisible on black — the same
 * choice the LocaleSwitcher already makes two rows below.
 *
 * Copy arrives as a prop, resolved against the URL locale by the server, for
 * the same reason the get-the-app fold takes one: next-intl would answer with
 * the device locale and put Spanish headings on /pt-br.
 */
// Split out for the same reason as the hero lockup and the get-the-app fold:
// FooterChrome imports this block statically, so a static DownloadQR here drags
// QRCodeWrapper -> react-qr-code into the main chunk of every page that mounts
// the footer, flag off included. It renders on desktop after mount only.
const DownloadQR = dynamic(() => import('@/components/Migration/DownloadQR'), { ssr: false })

export function FooterGetTheApp({ strings }: { strings: LandingMigrationStrings }) {
    const migrationOn = useMigrationFlag()
    const { deviceType } = useDeviceType()
    const isDesktop = deviceType === DeviceType.WEB

    if (!migrationOn) return null

    return (
        <div className="mb-8 flex flex-col items-start justify-between gap-6 border-b border-white/20 pb-8 md:flex-row md:items-center">
            <div className="flex w-full flex-col gap-3 md:max-w-xl">
                <h2 className="text-xl font-bold text-white">{strings.qrTitle}</h2>
                <p className="text-xs text-white/70">{strings.scanHint}</p>
                {isDesktop ? (
                    <StorePair surface={MIGRATION_SURFACES.LANDING_FOOTER} appearance="footer" className="mt-1" />
                ) : (
                    <PhoneAppCta surface={MIGRATION_SURFACES.LANDING_FOOTER} strings={strings} />
                )}
            </div>
            {/* the QR is the desktop half of the block — a phone cannot scan itself,
                and mounting it there would count an impression nobody can see */}
            {isDesktop && (
                <div className="hidden md:block">
                    <DownloadQR surface={MIGRATION_SURFACES.LANDING_FOOTER} size={224} bare handoff={AMBIENT_HANDOFF} />
                </div>
            )}
        </div>
    )
}
