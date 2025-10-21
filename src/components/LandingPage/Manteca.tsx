import { motion } from 'framer-motion'
import borderCloud from '@/assets/illustrations/border-cloud.svg'
import { useEffect, useState } from 'react'
import mantecaIphone from '@/assets/iphone-ss/manteca_ss.png'
import Image from 'next/image'
import { MEPA_ARGENTINA_LOGO, PIX_BRZ_LOGO } from '@/assets'

const Manteca = () => {
    const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)

    const createCloudAnimation = (side: 'left' | 'right', top: string, width: number, speed: number) => {
        const vpWidth = screenWidth || 1080
        const totalDistance = vpWidth + width

        return {
            initial: { x: side === 'left' ? -width : vpWidth },
            animate: { x: side === 'left' ? vpWidth : -width },
            transition: {
                ease: 'linear',
                duration: totalDistance / speed,
                repeat: Infinity,
            },
        }
    }

    useEffect(() => {
        const handleResize = () => {
            setScreenWidth(window.innerWidth)
        }

        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    return (
        <section className="relative h-[750px] overflow-hidden py-20 text-n-1" style={{ backgroundColor: '#F9F4F0' }}>
            <div className="absolute left-0 top-0 h-full w-full overflow-hidden">
                {/* Animated clouds */}
                <motion.img
                    src={borderCloud.src}
                    alt="Floating Border Cloud"
                    className="absolute left-0"
                    style={{ top: '20%', width: 200 }}
                    {...createCloudAnimation('left', '20%', 200, 35)}
                />
                <motion.img
                    src={borderCloud.src}
                    alt="Floating Border Cloud"
                    className="absolute right-0"
                    style={{ top: '60%', width: 220 }}
                    {...createCloudAnimation('right', '60%', 220, 40)}
                />
            </div>

            <div className="relative flex flex-col items-center justify-center">
                <h1 className="font-roboto-flex-extrabold text-center text-[4rem] font-extraBlack md:text-left lg:text-headingMedium">
                    SCAN. PAY. DONE.
                </h1>

                <h2 className="font-roboto-flex mt-6 text-left text-xl md:text-5xl">
                    Pay instantly in <b>Argentina</b> and <b>Brazil</b>.
                </h2>

                <h2 className="font-roboto-flex mt-6 text-left text-xl md:text-4xl">
                    JUST SCAN LOCAL QR codes. No bank details needed.
                </h2>

                <h3 className="font-roboto-flex mt-6 text-left text-xl md:text-xl">
                    About <b>5% cheaper</b> than Visa & Mastercard.
                </h3>
            </div>
            <div className="absolute -bottom-24 left-1/2 mx-auto flex -translate-x-1/2 items-center justify-center gap-10">
                <Image src={MEPA_ARGENTINA_LOGO} alt="Mepa Argentina" width={150} height={150} />
                <Image src={mantecaIphone} alt="Mercado pago payment" width={250} height={250} />
                <Image src={PIX_BRZ_LOGO} alt="Pix Brz" width={150} height={150} />
            </div>
        </section>
    )
}

export default Manteca
