'use client'
import { Star } from '@/assets'
import { motion } from 'framer-motion'
import borderCloud from '@/assets/illustrations/border-cloud.svg'

const CloudAnimation = ({
    top,
    imageSrc,
    styleMod,
    screenWidth,
    width = 200,
    speed = 45,
    delay = 0,
    direction = 'left-to-right',
}: {
    top: string
    imageSrc: string
    styleMod?: string
    screenWidth?: number
    width?: number
    speed?: number
    delay?: number
    direction?: 'left-to-right' | 'right-to-left'
}) => {
    const vpWidth = screenWidth || 1080
    const totalDistance = vpWidth + width

    return (
        <motion.img
            src={imageSrc}
            alt="Floating Cloud"
            className={`absolute left-0 ${styleMod || ''}`}
            style={{ top, width }}
            initial={{
                x: direction === 'left-to-right' ? -width : vpWidth,
            }}
            animate={{
                x: direction === 'left-to-right' ? vpWidth : -width,
            }}
            transition={{
                ease: 'linear',
                duration: totalDistance / speed,
                repeat: Infinity,
                delay: delay,
            }}
        />
    )
}

export const CloudImages = ({ screenWidth }: { screenWidth: number }) => {
    return (
        <div className="absolute left-0 top-0 h-full w-full overflow-hidden">
            {/* 3 clouds moving left-to-right */}
            <CloudAnimation
                top="10%"
                imageSrc={borderCloud.src}
                screenWidth={screenWidth}
                width={180}
                speed={30}
                delay={0}
                direction="left-to-right"
            />
            <CloudAnimation
                top="45%"
                imageSrc={borderCloud.src}
                screenWidth={screenWidth}
                width={220}
                speed={40}
                delay={0}
                direction="left-to-right"
            />
            <CloudAnimation
                top="80%"
                imageSrc={borderCloud.src}
                screenWidth={screenWidth}
                width={210}
                speed={38}
                delay={0}
                direction="left-to-right"
            />

            {/* 2 clouds moving right-to-left */}
            <CloudAnimation
                top="25%"
                imageSrc={borderCloud.src}
                screenWidth={screenWidth}
                width={200}
                speed={35}
                delay={0}
                direction="right-to-left"
            />
            <CloudAnimation
                top="65%"
                imageSrc={borderCloud.src}
                screenWidth={screenWidth}
                width={190}
                speed={32}
                delay={0}
                direction="right-to-left"
            />
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
        </>
    )
}
