'use client'
import Image from 'next/image'
import starImage from '@/assets/icons/star.png'
import { Icon } from '../Global/Icons/Icon'
import { twMerge } from 'tailwind-merge'
import { useGetBrowserType, BrowserType } from '@/hooks/useGetBrowserType'
import { useTranslations } from 'next-intl'

const ForceIOSPWAInstall = () => {
    const t = useTranslations('global')
    const { browserType, isLoading } = useGetBrowserType()

    const STAR_POSITIONS = [
        'left-[5%] top-[15%] size-10',
        'right-[10%] top-[10%] size-10',
        'left-[5%] bottom-[15%] size-10',
        'right-[10%] bottom-[15%] size-10',
    ] as const

    // Select the appropriate video based on browser type
    const getVideoSource = (): string => {
        switch (browserType) {
            case BrowserType.CHROME:
            case BrowserType.EDGE:
            case BrowserType.BRAVE:
            case BrowserType.OPERA:
                return '/iosPwaChrome.mov'
            case BrowserType.SAFARI:
            default:
                return '/iosPwaSafari.mov'
        }
    }

    const videoSource = getVideoSource()

    return (
        <main className="h-[100dvh] w-full">
            <section className="relative flex h-1/2 w-full items-center justify-center overflow-hidden bg-secondary-3 p-10">
                {STAR_POSITIONS.map((positions, index) => (
                    <Image
                        key={index}
                        src={starImage.src}
                        alt="star"
                        width={56}
                        height={56}
                        className={twMerge(positions, 'absolute z-10')}
                        priority={index === 0}
                    />
                ))}

                {!isLoading && (
                    <video className="h-96 w-96 object-contain" autoPlay loop muted playsInline key={videoSource}>
                        <source src={videoSource} type="video/quicktime" />
                        {t('forceIosPwaInstall.videoUnsupported')}
                    </video>
                )}
            </section>
            <section className="flex h-1/2 w-full flex-col gap-4 bg-white p-4">
                <h1 className="text-3xl font-bold">{t('forceIosPwaInstall.title')}</h1>
                <h2 className="text-base font-medium">{t('forceIosPwaInstall.subtitle')}</h2>
                <h3>{t('forceIosPwaInstall.description')}</h3>
                <p className="flex items-center gap-1">
                    {t.rich('forceIosPwaInstall.tapShare', {
                        share: (chunks) => (
                            <span className="flex items-center gap-1 font-bold">
                                <Icon name="share" size={16} /> {chunks}
                            </span>
                        ),
                    })}
                </p>
                <p>
                    {t.rich('forceIosPwaInstall.thenTapAddToHomeScreen', {
                        bold: (chunks) => <span className="font-bold">{chunks}</span>,
                    })}
                </p>
            </section>
        </main>
    )
}

export default ForceIOSPWAInstall
