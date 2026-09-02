'use client'
import { useEffect } from 'react'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import MigrationHero from '@/components/Migration/MigrationHero'
import StoreButtons from '@/components/Migration/StoreButtons'
import SupportDrawer from '@/components/Global/SupportDrawer'
import { useModalsContext } from '@/context/ModalsContext'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'

/**
 * Full-screen block once the website is switched off (TASK-20827) — rendered
 * by the mobile-ui layout instead of the app. Download is the only way
 * forward; the support link covers people who can't install (keep-web
 * bypass is handed out there).
 */
export default function SunsetScreen() {
    const t = useTranslations('migration')
    const { setIsSupportModalOpen } = useModalsContext()

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.MIGRATION_SUNSET_VIEWED)
    }, [])

    return (
        // mobile: 50/50 vertical split, copy at the top of the lower half and
        // the CTA pinned to the bottom. desktop (md+): 50/50 row, hero left,
        // content centered right.
        <div className="flex min-h-[100dvh] w-full flex-col bg-white md:flex-row">
            <MigrationHero className="h-[50dvh] md:h-auto md:w-1/2" />
            <section className="flex flex-1 flex-col justify-between p-6 pb-[calc(1.5rem_+_var(--safe-bottom))] md:w-1/2 md:justify-center md:gap-10">
                {/* centered on desktop to match the centered store CTA below */}
                <div className="mx-auto flex w-full max-w-md flex-col gap-3 md:text-center">
                    <h1 className="text-heading-m text-foreground-primary">{t('sunset.heading')}</h1>
                    <p className="text-body-m text-foreground-secondary">{t('sunset.sub')}</p>
                </div>
                <div className="mx-auto flex w-full max-w-md flex-col gap-4">
                    <StoreButtons surface={MIGRATION_SURFACES.SUNSET_SCREEN} />
                    <LinkButton onClick={() => setIsSupportModalOpen(true)} className="self-center">
                        {t('sunset.supportLink')}
                    </LinkButton>
                </div>
            </section>
            {/* the layout's SupportDrawer never mounts when this screen replaces it */}
            <SupportDrawer />
        </div>
    )
}
