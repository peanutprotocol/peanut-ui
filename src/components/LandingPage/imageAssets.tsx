'use client'
import { Cloud, Star } from '@/assets'
import { motion } from 'framer-motion'

const CloudAnimation = ({
    side,
    top,
    imageSrc,
    styleMod,
    screenWidth,
    speed = 45,
    startXOffset = 0,
}: {
    side: 'left' | 'right'
    top: string
    duration: number
    imageSrc: string
    styleMod?: string
    screenWidth?: number
    speed?: number
    startXOffset?: number
}) => {
    const imageWidth = 340 // Width of the cloud image (adjust as needed)
    const vpWidth = screenWidth || 1080

    // Total travel distance is screen width + image width + offset
    const totalDistance = vpWidth + imageWidth

    return (
        <motion.img
            src={imageSrc}
            alt={`Floating Cloud ${side}`}
            className={`absolute ${side}-0 ${styleMod || ''}`}
            style={{ top, width: imageWidth }}
            initial={{
                x: side === 'left' ? -imageWidth : vpWidth + startXOffset,
            }}
            animate={{
                x: side === 'left' ? [vpWidth, -imageWidth] : [-imageWidth, vpWidth],
            }}
            transition={{
                ease: 'linear',
                duration: totalDistance / speed,
                repeat: Infinity,
            }}
        />
    )
}

export const CloudImages = ({ screenWidth }: { screenWidth: number }) => {
    return (
        <div className="absolute left-0 top-0 h-full w-full overflow-hidden">
            {/* Right side clouds */}
            <CloudAnimation
                side="right"
                top="5%"
                duration={10}
                imageSrc={Cloud.src}
                screenWidth={screenWidth}
                startXOffset={-200}
                speed={55}
            />
            <CloudAnimation
                side="right"
                top="35%"
                duration={12}
                imageSrc={Cloud.src}
                styleMod="scale-50"
                screenWidth={screenWidth}
                startXOffset={100}
                speed={35}
            />
            {/* <CloudAnimation
                side="right"
                top="65%"
                duration={14}
                imageSrc={Cloud.src}
                screenWidth={screenWidth}
                startXOffset={300}
                speed={60}
            /> */}

            {/* Left side clouds */}
            <CloudAnimation
                side="left"
                top="15%"
                duration={15}
                imageSrc={Cloud.src}
                styleMod="scale-50"
                screenWidth={screenWidth}
                startXOffset={-100}
                speed={30}
            />
            <CloudAnimation
                side="left"
                top="45%"
                duration={18}
                imageSrc={Cloud.src}
                screenWidth={screenWidth}
                startXOffset={200}
                speed={40}
            />
            {/* <CloudAnimation
                side="left"
                top="75%"
                duration={20}
                imageSrc={Cloud.src}
                styleMod="z-[99]"
                screenWidth={screenWidth}
                startXOffset={50}
                speed={45}
            /> */}
        </div>
    )
}

export const HeroImages = () => {
    return (
        <>
            <motion.img
                initial={{ opacity: 0, translateY: 20, translateX: 5 }}
                whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                transition={{ type: 'spring', damping: 5 }}
                src={Star.src}
                className="absolute bottom-[-4%] left-[1%] w-8 sm:bottom-[11%] sm:left-[12%] md:bottom-[18%] md:left-[5%] md:w-12"
            />
            <motion.img
                initial={{ opacity: 0, translateY: 28, translateX: -5 }}
                whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                transition={{ type: 'spring', damping: 5 }}
                src={Star.src}
                className="absolute right-[1.5%] top-[-12%] w-8 sm:right-[6%] sm:top-[8%] md:right-[5%] md:top-[8%] md:w-12 lg:right-[10%]"
            />
            {/* <motion.img
                initial={{ rotate: 5, opacity: 0, translateY: 28, translateX: -5, transformOrigin: 'top left' }}
                whileInView={{ rotate: 0, opacity: 1, translateY: 0, translateX: 0, transformOrigin: 'top left' }}
                whileHover={{ rotate: 5, transformOrigin: 'top left' }}
                transition={{ type: 'spring', damping: 10 }}
                src={HandToken.src}
                className="absolute left-[7%] top-[63%] hidden w-36 md:left-[1%] md:top-[70%] lg:left-[7%] lg:top-[63%] lg:block xl:left-[11%]"
            /> */}
        </>
    )
}
