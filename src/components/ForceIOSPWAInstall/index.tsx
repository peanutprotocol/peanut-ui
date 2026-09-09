'use client'
import Image from 'next/image'
import starImage from '@/assets/icons/star.png'
import { Icon } from '../Global/Icons/Icon'
import { Button } from '@/components/0_Bruddle/Button'
import { twMerge } from '@/utils/tw'
import { useGetBrowserType, BrowserType } from '@/hooks/useGetBrowserType'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { useTranslations } from 'next-intl'

const ForceIOSPWAInstall = () => {
    const t = useTranslations('global')
    const dispatch = useAppDispatch()
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
        <main className="flex h-dvh w-full flex-col">
            {/* Hero takes the leftover height and the preview scales into it —
                a fixed half-and-half split cropped the phone on short screens. */}
            <section className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-blue-300 px-6 py-6 pt-[calc(1.5rem_+_var(--safe-top))]">
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
                    <video
                        className="h-full max-h-96 w-full max-w-96 object-contain"
                        autoPlay
                        loop
                        muted
                        playsInline
                        key={videoSource}
                    >
                        <source src={videoSource} type="video/quicktime" />
                        {t('forceIosPwaInstall.videoUnsupported')}
                    </video>
                )}
            </section>
            <section className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto bg-white p-4 pb-[calc(1rem_+_var(--safe-bottom))]">
                <h1 className="text-heading-m">{t('forceIosPwaInstall.title')}</h1>
                <h2 className="text-body-m">{t('forceIosPwaInstall.subtitle')}</h2>
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
                {/* Installing is a nudge, not a gate: without this the screen has
                    no control at all and a user who can't install is stranded. */}
                <Button variant="stroke" onClick={() => dispatch(setupActions.setShowIosPwaInstallScreen(false))}>
                    {t('forceIosPwaInstall.continueInBrowser')}
                </Button>
            </section>
        </main>
    )
}

export default ForceIOSPWAInstall
