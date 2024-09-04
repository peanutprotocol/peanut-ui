import Marquee from 'react-fast-marquee'
import { Box } from '@chakra-ui/react'

type directionType = 'left' | 'right' | 'up' | 'down' | undefined

export function MarqueeWrapper({
    children,
    backgroundColor,
    onClick,
    direction = 'left',
    className = 'border-b-2 border-black border',
}: {
    children: React.ReactNode
    backgroundColor: string
    onClick?: () => void
    direction?: string
    className?: string
}) {
    const baseClass = `max-h-18 mx-auto h-full w-full items-center italic  text-black  ${className} ${backgroundColor}`
    const _className = onClick ? `${baseClass} cursor-pointer` : baseClass

    return (
        <div className={_className} onClick={onClick}>
            <Marquee autoFill speed={30} direction={direction as directionType}>
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
        <Box borderY={'2px solid'} borderColor={'white'} className="shadow">
            <MarqueeWrapper backgroundColor="bg-primary" direction="left" className="border-y-2 border-n-1">
                <div className="mx-3 font-display text-lg uppercase not-italic md:text-xl">{message}</div>

                <div className="mx-3 py-2">
                    <img src={imageSrc} className={`${imageAnimationClass} h-auto w-8`} />
                </div>
            </MarqueeWrapper>
        </Box>
    )
}
