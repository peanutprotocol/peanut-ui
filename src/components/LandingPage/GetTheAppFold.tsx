'use client'

import Image from 'next/image'
import appScanScreen from '@/assets/illustrations/app-scan-screen.png'
import DownloadQR from '@/components/Migration/DownloadQR'
import StorePair from '@/components/Migration/StorePair'
import { PhoneAppCta } from './PhoneAppCta'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { AMBIENT_HANDOFF } from '@/utils/migration.utils'
import type { LandingMigrationStrings } from './landingStrings'

/**
 * Fold 10 with the flag on: "Send in seconds" becomes "Get the app". The
 * scanner screen inside a hand-drawn phone outline shows what the app does,
 * the QR is how a laptop gets it onto a phone, and the store pair is for
 * anyone who would rather tap than scan.
 *
 * The outline is a border and a hard shadow, not phone art — a drawn device
 * frame dates the moment the hardware changes, and the mock-up review rejected
 * anything beyond it.
 */
export function GetTheAppFold({
    strings,
    tagline,
    subtext,
}: {
    strings: LandingMigrationStrings
    tagline: React.ReactNode
    subtext?: string
}) {
    return (
        <>
            <h1 className="font-roboto-flex-extrabold text-6xl font-extraBlack text-black md:text-headingMedium">
                {strings.getTheApp}
            </h1>

            <p
                className="mt-6 mb-6 hidden font-roboto text-base leading-tight font-medium md:mb-10 md:block md:text-4xl"
                style={{ fontWeight: 500, letterSpacing: '-0.5px' }}
            >
                {tagline}
            </p>

            {/* gap tightens at md and only opens up at lg: at exactly 768px the row
                needs 220 (phone) + 228 (QR frame) + 208 (store column) + 2 gaps, which
                overflows the 736px content box at gap-14 and silently shrinks the QR
                below the 192px module area the fold is specified at. */}
            <div className="mt-8 flex flex-col items-center justify-center gap-10 md:mt-0 md:flex-row md:items-center md:gap-8 lg:gap-14">
                {/* the capture is a 960x2082 screenshot downscaled to 360px wide;
                    the frame crops it to the phone's aspect rather than squashing it */}
                <div className="relative h-[360px] w-[180px] shrink-0 overflow-hidden rounded-[24px] border-2 border-black bg-black shadow-[6px_6px_0_#000] md:h-[440px] md:w-[220px] md:rounded-[28px]">
                    <Image
                        src={appScanScreen}
                        alt=""
                        aria-hidden
                        sizes="220px"
                        className="h-full w-full object-cover"
                    />
                </div>

                {/* desktop only: a QR is useless on the phone that would scan it */}
                <div className="hidden flex-col items-center gap-3 md:flex">
                    <DownloadQR
                        surface={MIGRATION_SURFACES.LANDING_APP_FOLD}
                        size={224}
                        bare
                        handoff={AMBIENT_HANDOFF}
                    />
                    <span className="text-sm text-grey-1">{strings.scanHint}</span>
                </div>

                <div className="hidden flex-col items-center gap-3 md:flex">
                    <StorePair
                        surface={MIGRATION_SURFACES.LANDING_APP_FOLD}
                        appearance="stacked"
                        className="max-w-[13rem]"
                    />
                    {subtext && <span className="block text-center text-base text-n-1 italic">{subtext}</span>}
                </div>

                <div className="flex w-full max-w-sm md:hidden">
                    <PhoneAppCta surface={MIGRATION_SURFACES.LANDING_APP_FOLD} strings={strings} subtext={subtext} />
                </div>
            </div>
        </>
    )
}
