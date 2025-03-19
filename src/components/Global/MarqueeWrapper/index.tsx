'use client'

import { Box } from '@chakra-ui/react'
import Marquee from 'react-fast-marquee'

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
    className = 'border-b-1 border-black border',
}: MarqueeWrapperProps) {
    const baseClass = `${className} ${backgroundColor}`
    const _className = onClick ? `${baseClass} cursor-pointer` : baseClass

    return (
        <div className={_className} onClick={onClick}>
            <Marquee autoFill speed={30} direction={direction}>
                <div className="flex flex-row items-center">{children}</div>
            </Marquee>
        </div>
    )
}

// MarqueeComp: A pre-configured marquee component with message and image
export function MarqueeComp({
    message,
    imageSrc,
    imageAnimationClass = 'animation-thumbsUp',
    backgroundColor = 'bg-primary', // Add default value
}: {
    message?: string | string[]
    imageSrc: string
    imageAnimationClass?: string
    backgroundColor?: string // Add new prop
}) {
    return (
        <Box className="border-y-1 border-white shadow">
            <MarqueeWrapper backgroundColor={backgroundColor} direction="left" className="border-y-2 border-n-1">
                {Array.isArray(message)
                    ? message.map((msg, index) => (
                          <div key={index} className="mx-3 inline-flex min-h-12 items-center gap-3 py-2">
                              <div className="text-lg font-bold uppercase md:text-xl">{msg}</div>
                              {index < message.length && (
                                  <img
                                      src={imageSrc}
                                      alt="Marquee Image"
                                      className={`${imageAnimationClass || ''} ml-2 h-auto w-8`}
                                  />
                              )}
                          </div>
                      ))
                    : message && (
                          <div className="mx-3 inline-flex min-h-12 items-center py-2">
                              <div className="text-lg font-bold uppercase md:text-xl">{message}</div>
                              <img
                                  src={imageSrc}
                                  alt="Marquee Image"
                                  className={`${imageAnimationClass || ''} ml-2 h-auto w-8`}
                              />
                          </div>
                      )}
            </MarqueeWrapper>
        </Box>
    )
}
