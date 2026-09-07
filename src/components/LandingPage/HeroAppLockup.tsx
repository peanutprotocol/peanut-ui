'use client'

import DownloadQR from '@/components/Migration/DownloadQR'
import StorePair from '@/components/Migration/StorePair'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { AMBIENT_HANDOFF } from '@/utils/migration.utils'
import type { LandingMigrationStrings } from './landingStrings'

/**
 * Desktop hero CTA during the migration window: the QR, the scan hint, the
 * store pair and the content-system subtext as one lockup.
 *
 * Horizontal from lg up (QR left, the rest right) and stacked below it. The
 * horizontal arrangement is ~90px shorter, which is what keeps the marquee
 * inside the fold on a 1366x768 laptop; the stacked one reads better once the
 * column is narrow enough that a side-by-side pair would wrap anyway.
 */
export function HeroAppLockup({ strings, subtext }: { strings: LandingMigrationStrings; subtext?: string }) {
    return (
        <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-center lg:gap-7">
            <DownloadQR
                surface={MIGRATION_SURFACES.LANDING_HERO}
                size={192}
                bare
                handoff={AMBIENT_HANDOFF}
                className="shrink-0"
            />
            <div className="flex flex-col items-center gap-3 lg:items-start">
                <span className="text-center text-sm text-n-1 lg:text-left lg:text-lg lg:font-bold">
                    {strings.scanHint}
                </span>
                <StorePair surface={MIGRATION_SURFACES.LANDING_HERO} appearance="hero" />
                {subtext && <span className="block text-center text-sm text-n-1 italic md:text-base">{subtext}</span>}
            </div>
        </div>
    )
}
