'use client'
import { useEffect } from 'react'
import Image from 'next/image'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import StoreButtons from '@/components/Migration/StoreButtons'
import SupportDrawer from '@/components/Global/SupportDrawer'
import { useModalsContext } from '@/context/ModalsContext'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { PEANUTMAN_MOBILE } from '@/assets/mascot'
import starImage from '@/assets/icons/star.png'

const STARS = ['left-[8%] top-[18%] size-8', 'right-[12%] top-[14%] size-9', 'right-[14%] bottom-[16%] size-7'] as const

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
            <section
                className="relative flex h-[50dvh] w-full items-center justify-center overflow-hidden bg-secondary-3 px-6 md:h-auto md:w-1/2"
                style={{ paddingTop: 'env(safe-area-inset-top)' }}
            >
                {STARS.map((pos) => (
                    <Image
                        key={pos}
                        src={starImage.src}
                        alt=""
                        width={38}
                        height={38}
                        className={`absolute z-10 ${pos}`}
                    />
                ))}
                <Image
                    src={PEANUTMAN_MOBILE}
                    alt="Peanut"
                    width={200}
                    height={200}
                    className="z-0 h-44 w-auto object-contain md:h-56"
                />
            </section>
            <section className="flex flex-1 flex-col justify-between p-6 pb-[calc(1.5rem_+_env(safe-area-inset-bottom))] md:w-1/2 md:justify-center md:gap-10">
                <div className="mx-auto flex w-full max-w-md flex-col gap-3">
                    <h1 className="text-3xl font-bold text-n-1">{t('sunset.heading')}</h1>
                    <p className="text-base text-grey-1">{t('sunset.sub')}</p>
                </div>
                <div className="mx-auto flex w-full max-w-md flex-col gap-4">
                    <StoreButtons surface={MIGRATION_SURFACES.SUNSET_SCREEN} />
                    <Button
                        variant="transparent"
                        className="h-6 text-sm font-normal text-black underline"
                        onClick={() => setIsSupportModalOpen(true)}
                    >
                        {t('sunset.supportLink')}
                    </Button>
                </div>
            </section>
            {/* the layout's SupportDrawer never mounts when this screen replaces it */}
            <SupportDrawer />
        </div>
    )
}
