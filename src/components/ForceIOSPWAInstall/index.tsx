'use client'
import Image from 'next/image'
import starImage from '@/assets/icons/star.png'
import { Icon } from '../Global/Icons/Icon'
import { twMerge } from 'tailwind-merge'
import { useGetBrowserType, BrowserType } from '@/hooks/useGetBrowserType'

const ForceIOSPWAInstall = () => {
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
                        Your browser does not support the video tag.
                    </video>
                )}
            </section>
            <section className="flex h-1/2 w-full flex-col gap-4 bg-white p-4">
                <h1 className="text-3xl font-bold">Get the full experience</h1>
                <h2 className="text-base font-medium">This is the final step!</h2>
                <h3>Add Peanut to your home screen to unlock your wallet and start using it.</h3>
                <p className="flex items-center gap-1">
                    Tap the{' '}
                    <span className="flex items-center gap-1 font-bold">
                        <Icon name="share" size={16} /> Share icon
                    </span>
                    on your browser
                </p>
                <p>
                    and then on <span className="font-bold"> “Add To Home Screen”</span>{' '}
                </p>
            </section>
        </main>
    )
}

export default ForceIOSPWAInstall
