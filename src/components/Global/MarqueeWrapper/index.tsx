'use client'

import Marquee from 'react-fast-marquee'
import { Box } from '@chakra-ui/react'

type directionType = 'left' | 'right' | 'up' | 'down' | undefined

interface MarqueeWrapperProps {
    children: React.ReactNode
    backgroundColor: string
    onClick?: () => void
    direction?: directionType
    className?: string
}

export function MarqueeWrapper({
    children,
    backgroundColor,
    onClick,
    direction = 'left',
    className = 'border-b-2 border-black border',
}: MarqueeWrapperProps) {
    const baseClass = `mx-auto w-full items-center italic text-black ${className} ${backgroundColor}`
    const _className = onClick ? `${baseClass} cursor-pointer` : baseClass

    return (
        <div className={_className} onClick={onClick}>
            <Marquee autoFill speed={30} direction={direction}>
                <div className="flex flex-row items-center">{children}</div>
            </Marquee>
        </div>
    )
}

export function MarqueeComp({
    message,
    imageSrc,
    imageAnimationClass = 'animation-thumbsUp',
}: {
    message?: string
    imageSrc: string
    imageAnimationClass?: string
}) {
    return (
        <Box className="border-y-1 border-white shadow">
            <MarqueeWrapper backgroundColor="bg-primary" direction="left" className="border-y-2 border-n-1">
                {message && <div className="mx-3 text-lg font-bold uppercase not-italic md:text-xl">{message}</div>}

                <div className="mx-3 py-2">
                    <img src={imageSrc} alt="Marquee Image" className={`${imageAnimationClass || ''} h-auto w-8`} />
                </div>
            </MarqueeWrapper>
        </Box>
    )
}
