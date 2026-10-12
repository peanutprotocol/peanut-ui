'use client'
import DownloadAppLink from '@/components/Migration/DownloadAppLink'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'

export function LandingDownloadCta({ subtext }: { subtext?: string }) {
    return (
        <div className="flex flex-col items-center" data-testid="landing-download-cta">
            <DownloadAppLink
                surface={MIGRATION_SURFACES.LANDING_HERO}
                buttonClassName="bg-white px-8 hover:bg-white/90 active:bg-white/90"
            />
            {subtext && (
                <span className="mt-2 block text-center text-body-s text-foreground-primary italic md:text-body-m">
                    {subtext}
                </span>
            )}
        </div>
    )
}
