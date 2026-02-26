import Image from 'next/image'
import exclamations from '@/assets/illustrations/exclamations.svg'
import payZeroFees from '@/assets/illustrations/pay-zero-fees.svg'
import mobileSendInSeconds from '@/assets/illustrations/mobile-send-in-seconds.svg'
import { Star } from '@/assets'
import { CloudsCss } from './CloudsCss'
import { AnimateOnView } from '@/components/Global/AnimateOnView'
import { SendInSecondsCTA } from './SendInSecondsCTA'

const sendInSecondsClouds = [
    { top: '15%', width: 320, speed: '40s', direction: 'ltr' as const },
    { top: '40%', width: 200, speed: '34s', direction: 'rtl' as const },
    { top: '70%', width: 180, speed: '30s', direction: 'ltr' as const },
    { top: '80%', width: 320, speed: '46s', direction: 'rtl' as const },
]

const starConfigs = [
    {
        className: 'absolute right-10 top-10 md:right-1/4 md:top-20',
        width: 50,
        height: 50,
        delay: '0.2s',
        x: '5px',
        rotate: '45deg',
    },
    { className: 'absolute bottom-16 left-1/3', width: 40, height: 40, delay: '0.4s', x: '-5px', rotate: '-10deg' },
    {
        className: 'absolute bottom-20 left-[2rem] md:bottom-72 md:right-[14rem]',
        width: 50,
        height: 50,
        delay: '0.6s',
        x: '5px',
        rotate: '-22deg',
    },
    { className: 'absolute left-[20rem] top-72', width: 60, height: 60, delay: '0.8s', x: '-5px', rotate: '12deg' },
]

export function SendInSeconds() {
    return (
        <section id="send-in-seconds" className="relative overflow-hidden bg-secondary-1 px-4 py-16 text-n-1 md:py-32">
            <CloudsCss clouds={sendInSecondsClouds} />

            {starConfigs.map((config, i) => (
                <AnimateOnView
                    key={i}
                    className={config.className}
                    delay={config.delay}
                    x={config.x}
                    rotate={config.rotate}
                >
                    <img src={Star.src} alt="" width={config.width} height={config.height} />
                </AnimateOnView>
            ))}

            {/* Exclamations */}
            <Image
                src={exclamations}
                alt="Exclamations"
                width={200}
                height={300}
                className="absolute right-72 top-1/3 hidden -translate-y-1/2 transform md:block"
            />

            {/* Main content */}
            <div className="relative mx-auto max-w-3xl text-center">
                <div className="mb-6 md:mb-10">
                    {/* Mobile version */}
                    <Image
                        src={mobileSendInSeconds}
                        alt="Send in Seconds. Pay Zero Fees. Start Right Now"
                        width={800}
                        height={200}
                        className="mx-auto block h-auto w-[90%] md:hidden"
                    />
                    {/* Desktop version */}
                    <Image
                        src={payZeroFees}
                        alt="Send in Seconds. Pay Zero Fees. Start Right Now"
                        width={800}
                        height={200}
                        className="mx-auto hidden h-auto w-full max-w-lg md:block md:max-w-4xl"
                    />
                </div>

                <p
                    className="mb-6 hidden font-roboto text-base font-medium leading-tight md:mb-8 md:block md:text-4xl"
                    style={{ fontWeight: 500, letterSpacing: '-0.5px' }}
                >
                    MOVE MONEY WORLDWIDE INSTANTLY.
                    <br />
                    ALWAYS UNDER YOUR CONTROL.
                </p>

                <div id="sticky-button-target">
                    <SendInSecondsCTA />
                </div>
            </div>
        </section>
    )
}
