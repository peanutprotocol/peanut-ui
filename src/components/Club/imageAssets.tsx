'use client'
import { motion } from 'framer-motion'
import * as assets from '@/assets'

export const HeroImages = () => {
    return (
        <>
            <motion.img
                initial={{ opacity: 0, translateY: 20, translateX: 5 }}
                whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                whileHover={{ scale: 1.1, translateY: 2, translateX: 1, rotate: 2 }}
                transition={{ type: 'spring', damping: 5 }}
                src={assets.Star.src}
                className="absolute left-[16%] top-[20%] w-12 lg:top-[28%]"
            />
            <motion.img
                initial={{ opacity: 0, translateY: 28, translateX: -5 }}
                whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                whileHover={{ scale: 1.15, translateY: -1, translateX: -2, rotate: 3 }}
                transition={{ type: 'spring', damping: 5 }}
                src={assets.Star.src}
                className="absolute right-[14%] top-[66%] w-12  lg:top-[54%]"
            />
            <motion.img
                initial={{ rotate: 5, opacity: 0, translateY: 28, translateX: -5, transformOrigin: 'top left' }}
                whileInView={{ rotate: 0, opacity: 1, translateY: 0, translateX: 0, transformOrigin: 'top left' }}
                whileHover={{ rotate: 5, transformOrigin: 'top left' }}
                transition={{ type: 'spring', damping: 10 }}
                src={assets.HandToken.src}
                className="absolute left-[7%] top-[63%] w-36 md:left-[10%] md:top-[70%] lg:left-[7%] lg:top-[63%] xl:left-[11%]"
            />
        </>
    )
}

export const StoryImages = ({ index }: { index: number }) => {
    return (
        <>
            {index === 0 && (
                <>
                    <motion.img
                        initial={{ scale: 1.2, rotate: 5, translateY: 10 }}
                        whileInView={{ scale: 1, rotate: 0, translateY: 0 }}
                        whileHover={{ rotate: 4 }}
                        transition={{ type: 'spring', damping: 10 }}
                        src={assets.StopSign.src}
                        className="absolute -left-[52%] -top-4 w-40 -rotate-3 md:-left-[28%]"
                    />
                    <motion.img
                        initial={{ opacity: 0, translateY: 20, translateX: 5 }}
                        whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                        whileHover={{ scale: 1.1, translateY: 2, translateX: 1, rotate: 2 }}
                        transition={{ type: 'spring', damping: 5 }}
                        src={assets.Star.src}
                        className="absolute -left-[32%] top-[42%] w-14"
                    />
                </>
            )}

            {index === 1 && (
                <>
                    <motion.img
                        initial={{ scale: 1.2, rotate: 5, translateY: 10 }}
                        whileInView={{ scale: 1, rotate: 0, translateY: 0 }}
                        whileHover={{ rotate: 4 }}
                        transition={{ type: 'spring', damping: 10 }}
                        src={assets.EasySign.src}
                        className="absolute -right-[66%] top-[20%] w-48 rotate-6 md:-right-[38%] lg:-right-[48%]"
                    />
                    <motion.img
                        initial={{ scale: 1.2, rotate: -5, translateY: 10 }}
                        whileInView={{ scale: 1, rotate: 0, translateY: 0 }}
                        whileHover={{ rotate: -4 }}
                        transition={{ type: 'spring', damping: 10 }}
                        src={assets.HeyDudeSign.src}
                        className="absolute -right-[48%] -top-2 w-40 -rotate-3 md:-right-[25%] lg:-right-[35%]"
                    />

                    <motion.img
                        initial={{ opacity: 0, translateY: 18, translateX: -5 }}
                        whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                        whileHover={{ scale: 1.15, translateY: -1, translateX: -2, rotate: 3 }}
                        transition={{ type: 'spring', damping: 6 }}
                        src={assets.Star.src}
                        className="absolute -bottom-16 -right-[8%] w-14"
                    />
                </>
            )}
        </>
    )
}

export const FeaturesBadgeImage = () => {
    return (
        <motion.img
            initial={{ opacity: 0, translateY: 18, translateX: -5, rotate: 0, transformOrigin: 'bottom right' }}
            whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: 3, transformOrigin: 'bottom right' }}
            whileHover={{ translateY: 1, translateX: 2, rotate: 0.5, transformOrigin: 'bottom right' }}
            transition={{ type: 'spring', damping: 15 }}
            src={assets.ClaimChainsBadge.src}
            className="mx-auto w-80 -rotate-6 md:mt-8"
            alt="Send a link. Claim on 20+ Chains."
        />
    )
}

export const FeaturesImages = ({ index }: { index: number }) => {
    return (
        <>
            {index === 0 && (
                <>
                    <motion.img
                        initial={{ opacity: 0, translateY: 18, translateX: -5 }}
                        whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                        whileHover={{ scale: 1.15, translateY: -1, translateX: -2, rotate: 3 }}
                        transition={{ type: 'spring', damping: 6 }}
                        src={assets.SmileHigh.src}
                        className="absolute -left-10 -top-6 w-30 md:-top-16 md:left-[1%] lg:left-[14%] xl:left-[20%]"
                    />
                    <motion.img
                        initial={{ opacity: 0, translateY: 18, translateX: 5 }}
                        whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                        whileHover={{ scale: 1.15, translateY: 1, translateX: 2, rotate: 2 }}
                        transition={{ type: 'spring', damping: 6 }}
                        src={assets.SmileFinder.src}
                        className="absolute -left-12 top-8 w-28 md:-left-[2%] md:-top-4 lg:left-[12%] xl:left-[18%]"
                    />
                    <motion.img
                        initial={{
                            rotate: -5,
                            opacity: 0,
                            translateY: 22,
                            translateX: -5,
                            transformOrigin: 'bottom left',
                        }}
                        whileInView={{
                            rotate: 0,
                            opacity: 1,
                            translateY: 0,
                            translateX: 0,
                            transformOrigin: 'bottom left',
                        }}
                        whileHover={{ rotate: -6, transformOrigin: 'bottom left' }}
                        transition={{ type: 'spring', damping: 6 }}
                        src={assets.HandSnap.src}
                        className="absolute -right-6 top-2 w-20 md:-top-8 md:right-[1%] md:w-28 lg:-top-12 lg:right-[10%] xl:right-[20%]"
                    />
                </>
            )}

            {index === 1 && (
                <>
                    <motion.img
                        initial={{ opacity: 0, translateY: 18, translateX: -5 }}
                        whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                        whileHover={{ scale: 1.15, translateY: -1, translateX: -2, rotate: 3 }}
                        transition={{ type: 'spring', damping: 6 }}
                        src={assets.Star.src}
                        className="absolute -top-6 left-0 w-14 -rotate-3 md:left-[3%] lg:left-[2%] xl:left-[8%]"
                    />
                    <motion.img
                        initial={{ opacity: 0, translateY: 18, translateX: 5 }}
                        whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                        whileHover={{ scale: 1.15, translateY: 1, translateX: 2, rotate: 2 }}
                        transition={{ type: 'spring', damping: 6 }}
                        src={assets.GoodIdeaSign.src}
                        className="absolute -right-20 top-20 w-48 rotate-6 md:right-[2%] md:top-18 lg:-right-[3%] lg:top-32 xl:right-[7%] xl:top-18"
                    />
                    <motion.img
                        initial={{ opacity: 0, translateY: 18, translateX: 5 }}
                        whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                        whileHover={{ scale: 1.15, translateY: 1, translateX: 2, rotate: 2 }}
                        transition={{ type: 'spring', damping: 6 }}
                        src={assets.EyesEmoiji.src}
                        className="absolute -left-16 bottom-0 w-36 -rotate-6 md:-bottom-12 lg:-bottom-8 lg:left-[0%] xl:-bottom-18 xl:left-[7%]"
                    />
                    <motion.img
                        initial={{
                            rotate: 12,
                            transformOrigin: 'bottom left',
                            opacity: 0,
                        }}
                        whileInView={{
                            rotate: 0,
                            transformOrigin: 'bottom left',
                            opacity: 1,
                        }}
                        whileHover={{ rotate: -6, transformOrigin: 'bottom left' }}
                        transition={{ type: 'spring', damping: 6 }}
                        src={assets.HandBag.src}
                        className="absolute -bottom-16 right-[0%] hidden w-36 md:block lg:-bottom-32 lg:right-[20%] xl:-bottom-18 xl:right-6"
                    />
                </>
            )}
        </>
    )
}
