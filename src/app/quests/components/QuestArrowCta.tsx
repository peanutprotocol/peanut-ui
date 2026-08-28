'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Button } from '@/components/0_Bruddle/Button'
import { twMerge } from '@/utils/tw'

/**
 * The landing-page-style CTA button with the four hand-drawn arrows, shared by
 * the three quest surfaces. Label / target / spacing differ per caller.
 */
export function QuestArrowCta({
    label,
    onClick,
    className,
    buttonClassName,
}: {
    label: string
    onClick: () => void
    className?: string
    buttonClassName?: string
}) {
    return (
        <motion.div
            className={twMerge(
                'relative z-20 mx-auto flex w-fit cursor-pointer flex-col items-center justify-center',
                className
            )}
            initial={{ opacity: 0, translateY: 4, translateX: 0, rotate: 0.75 }}
            animate={{ opacity: 1, translateY: 0, translateX: 0, rotate: 0, scale: 1 }}
            whileHover={{ translateY: 6, translateX: 0, rotate: 0.75 }}
            transition={{ type: 'spring', damping: 15 }}
            onClick={onClick}
        >
            <Button shadowSize="4" className={buttonClassName}>
                {label}
            </Button>
            {/* Arrows like landing page */}
            <Image
                src="/arrows/small-arrow.svg"
                alt="Arrow"
                width={32}
                height={16}
                className="absolute -top-5 -left-8 block -translate-y-1/2 rotate-[8deg] transform md:hidden"
            />
            <Image
                src="/arrows/small-arrow.svg"
                alt="Arrow"
                width={32}
                height={16}
                className="absolute -top-5 -right-8 block -translate-y-1/2 scale-x-[-1] rotate-[-8deg] transform md:hidden"
            />
            <Image
                src="/arrows/small-arrow.svg"
                alt="Arrow"
                width={40}
                height={20}
                className="absolute -top-6 -left-10 hidden -translate-y-1/2 rotate-[8deg] transform md:block"
            />
            <Image
                src="/arrows/small-arrow.svg"
                alt="Arrow"
                width={40}
                height={20}
                className="absolute -top-6 -right-10 hidden -translate-y-1/2 scale-x-[-1] rotate-[-8deg] transform md:block"
            />
        </motion.div>
    )
}
