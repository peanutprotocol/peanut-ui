'use client'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { MIGRATION_SURFACES, STORE_URL } from '@/constants/migration.consts'

export function LandingDownloadCta({ subtext }: { subtext?: string }) {
    const t = useTranslations('migration')
    const { deviceType } = useDeviceType()
    const interceptAppCta = useAppModal()
    const isDesktop = deviceType === DeviceType.WEB
    const store = deviceType === DeviceType.ANDROID ? 'android' : 'ios'
    return (
        <div className="flex flex-col items-center" data-testid="landing-download-cta">
            <a
                href={isDesktop ? '/app' : STORE_URL[store]}
                onClick={(event) => {
                    if (interceptAppCta(MIGRATION_SURFACES.LANDING_HERO)) event.preventDefault()
                }}
            >
                <Button
                    shadowSize="4"
                    icon={isDesktop ? 'qr-code' : store === 'ios' ? 'apple-logo' : 'google-play'}
                    className="bg-white px-7 py-3 text-base font-extrabold hover:bg-white/90 md:px-9 md:py-8 md:text-xl"
                >
                    {t('downloadNow')}
                </Button>
            </a>
            {subtext && <span className="mt-2 block text-center text-sm text-n-1 italic md:text-base">{subtext}</span>}
            {!isDesktop && (
                <a className="mt-2 text-sm underline" href={STORE_URL[store === 'ios' ? 'android' : 'ios']}>
                    {t('otherStore')}
                </a>
            )}
        </div>
    )
}
