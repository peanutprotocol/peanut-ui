import { motion } from 'framer-motion'
import borderCloud from '@/assets/illustrations/border-cloud.svg'
import { useEffect, useState } from 'react'
import mantecaIphone from '@/assets/iphone-ss/manteca_ss.png'
import Image from 'next/image'
import { MEPA_ARGENTINA_LOGO, PIX_BRZ_LOGO, Star } from '@/assets'

const Manteca = () => {
    const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)

    const createCloudAnimation = (
        width: number,
        speed: number,
        delay: number = 0,
        direction: 'left-to-right' | 'right-to-left' = 'left-to-right'
    ) => {
        const vpWidth = screenWidth || 1080
        const totalDistance = vpWidth + width

        return {
            initial: { x: direction === 'left-to-right' ? -width : vpWidth },
            animate: { x: direction === 'left-to-right' ? vpWidth : -width },
            transition: {
                ease: 'linear',
                duration: totalDistance / speed,
                repeat: Infinity,
                delay: delay,
            },
        }
    }

    const cloudConfigs = [
        { top: '10%', width: 180, speed: 30, delay: 0, direction: 'left-to-right' as const },
        { top: '45%', width: 220, speed: 40, delay: 0, direction: 'left-to-right' as const },
        { top: '80%', width: 210, speed: 38, delay: 0, direction: 'left-to-right' as const },
        { top: '25%', width: 200, speed: 35, delay: 0, direction: 'right-to-left' as const },
        { top: '65%', width: 190, speed: 32, delay: 0, direction: 'right-to-left' as const },
    ]

    const starConfigs = [
        { className: 'absolute left-12 top-10', delay: 0.2 },
        { className: 'absolute left-56 top-1/2', delay: 0.2 },
        { className: 'absolute bottom-20 left-20', delay: 0.2 },
        { className: 'absolute -top-16 right-20 md:top-58', delay: 0.6 },
        { className: 'absolute bottom-20 right-44', delay: 0.6 },
    ]

    const isMobile = screenWidth < 768

    useEffect(() => {
        const handleResize = () => {
            setScreenWidth(window.innerWidth)
        }

        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    return (
        <section
            className="relative overflow-hidden py-20 text-n-1 md:h-[850px] lg:h-[750px]"
            style={{ backgroundColor: '#F9F4F0' }}
        >
            {!isMobile && (
                <div className="absolute left-0 top-0 h-full w-full overflow-hidden">
                    {/* Animated clouds */}
                    {cloudConfigs.map((config, index) => (
                        <motion.img
                            key={index}
                            src={borderCloud.src}
                            alt="Floating Border Cloud"
                            className="absolute left-0"
                            style={{ top: config.top, width: config.width }}
                            {...createCloudAnimation(config.width, config.speed, config.delay, config.direction)}
                        />
                    ))}
                </div>
            )}

            {!isMobile && (
                <>
                    {starConfigs.map((config, index) => (
                        <motion.img
                            key={index}
                            src={Star.src}
                            alt="Floating Star"
                            width={50}
                            height={50}
                            className={config.className}
                            initial={{ opacity: 0, translateY: 20, translateX: 5, rotate: 22 }}
                            whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: 22 }}
                            transition={{ type: 'spring', damping: 5, delay: config.delay }}
                        />
                    ))}
                </>
            )}

            <div className="relative flex flex-col items-center justify-center px-4">
                <h1 className="font-roboto-flex-extrabold text-center text-[4rem] font-extraBlack md:text-left lg:text-headingMedium">
                    SCAN. PAY. DONE.
                </h1>

                <h2 className="font-roboto-flex mt-6 text-center text-xl md:text-5xl">
                    PAY INSTANTLY IN <b>ARGENTINA</b> AND <b>BRAZIL</b>.
                </h2>

                <h2 className="font-roboto-flex mt-6 text-center text-xl md:text-4xl">
                    JUST SCAN LOCAL QR CODES. NO BANK DETAILS NEEDED.
                </h2>

                <h3 className="font-roboto-flex mt-6 text-center text-xl md:text-xl">
                    <b>~5% cheaper</b> than Visa & Mastercard.
                </h3>
            </div>

            {isMobile && (
                <div className="mt-4 flex flex-col items-center justify-center gap-4">
                    <Image src={mantecaIphone} alt="Mercado pago payment" width={250} height={250} />

                    <div className="flex gap-8">
                        <Image src={MEPA_ARGENTINA_LOGO} alt="Mepa Argentina" width={100} height={100} />
                        <Image src={PIX_BRZ_LOGO} alt="Pix Brz" width={100} height={100} />
                    </div>
                </div>
            )}

            {!isMobile && (
                <div className="absolute -bottom-24 left-1/2 mx-auto flex -translate-x-1/2 items-center justify-center gap-20 lg:gap-36">
                    <Image src={MEPA_ARGENTINA_LOGO} alt="Mepa Argentina" width={170} height={170} />
                    <Image src={mantecaIphone} alt="Mercado pago payment" width={250} height={250} />
                    <Image src={PIX_BRZ_LOGO} alt="Pix Brz" width={170} height={170} />
                </div>
            )}
        </section>
    )
}

export default Manteca
