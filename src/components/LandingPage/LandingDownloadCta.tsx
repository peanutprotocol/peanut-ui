'use client'
import DownloadAppLink from '@/components/Migration/DownloadAppLink'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { CTA_MOTION } from '@/components/Marketing/constants'

export function LandingDownloadCta({ subtext }: { subtext?: string }) {
    return (
        <div className="flex w-full flex-col items-center" data-testid="landing-download-cta">
            <DownloadAppLink
                surface={MIGRATION_SURFACES.LANDING_HERO}
                qrPlacement="hero"
                variant="secondary"
                size="large"
                className={`w-fit ${CTA_MOTION}`}
            />
            {subtext && (
                <span className="mt-2 block text-center text-body-s text-foreground-primary italic md:text-body-m">
                    {subtext}
                </span>
            )}
        </div>
    )
}
