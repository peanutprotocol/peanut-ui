'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import borderCloud from '@/assets/illustrations/border-cloud.svg'
import Star from '@/assets/illustrations/star.svg'

/**
 * The animated cloud + star backdrop shared by the three quest surfaces
 * (QuestsHero, /quests/explore, /quests/[questId]). One copy of the
 * drifting-cloud math and the fixed decoration positions instead of three.
 */
export function QuestHeroDecoration({ secondStarTop = '60%' }: { secondStarTop?: '50%' | '60%' }) {
    const [screenWidth, setScreenWidth] = useState(0)

    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth)
        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const createCloudAnimation = useCallback(
        (side: 'left' | 'right', width: number, speed: number) => {
            const vpWidth = screenWidth || 1080
            const totalDistance = vpWidth + width

            return {
                initial: { x: side === 'left' ? -width : vpWidth },
                animate: { x: side === 'left' ? vpWidth : -width },
                transition: {
                    ease: 'linear' as const,
                    duration: totalDistance / speed,
                    repeat: Infinity,
                },
            }
        },
        [screenWidth]
    )

    return (
        <>
            {/* Animated Clouds - Reduced for performance */}
            <div className="absolute top-0 left-0 h-full w-full overflow-hidden">
                <motion.img
                    src={borderCloud.src}
                    alt=""
                    className="absolute top-[15%] left-0 w-[180px]"
                    {...createCloudAnimation('left', 180, 35)}
                />
                <motion.img
                    src={borderCloud.src}
                    alt=""
                    className="absolute top-[40%] right-0 w-[200px]"
                    {...createCloudAnimation('right', 200, 40)}
                />
                <motion.img
                    src={borderCloud.src}
                    alt=""
                    className="absolute top-[70%] left-0 w-[190px]"
                    {...createCloudAnimation('left', 190, 38)}
                />
            </div>

            {/* Animated Stars - Fade in like landing page */}
            <motion.img
                initial={{ opacity: 0, translateY: 20, translateX: 5 }}
                whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                transition={{ type: 'spring', damping: 5 }}
                src={Star.src}
                alt=""
                className="absolute top-[20%] left-[15%] hidden w-[35px] md:block"
            />
            <motion.img
                initial={{ opacity: 0, translateY: 28, translateX: -5 }}
                whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                transition={{ type: 'spring', damping: 5 }}
                src={Star.src}
                alt=""
                className={`absolute right-[20%] hidden w-[40px] md:block ${
                    secondStarTop === '50%' ? 'top-[50%]' : 'top-[60%]'
                }`}
            />
        </>
    )
}
