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
        <div className="flex min-h-[100dvh] w-full items-center justify-center bg-background p-6">
            <div className="mx-auto flex w-full max-w-[380px] flex-col overflow-hidden rounded-sm border border-n-1 bg-white">
                <section className="relative flex h-64 w-full items-center justify-center overflow-hidden bg-secondary-3 px-6">
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
                        className="z-0 h-40 w-auto object-contain"
                    />
                </section>
                <section className="flex flex-col gap-3 bg-white p-6">
                    <h1 className="text-3xl font-bold text-n-1">{t('sunset.heading')}</h1>
                    <p className="text-base text-grey-1">{t('sunset.sub')}</p>
                    <div className="mt-4 flex flex-col gap-4">
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
            </div>
            {/* the layout's SupportDrawer never mounts when this screen replaces it */}
            <SupportDrawer />
        </div>
    )
}
