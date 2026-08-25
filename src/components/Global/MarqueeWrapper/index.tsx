'use client'

import Image from 'next/image'
import Link from 'next/link'
import Marquee from 'react-fast-marquee'
import type { MarqueeItem } from './marquee.types'

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

const wordClass = 'text-lg font-bold uppercase md:text-xl'

// A word is either plain text or a link — the strip looks identical either way,
// so a linked word still reads as part of the run of words.
function MarqueeWord({ item }: { item: MarqueeItem }) {
    if (typeof item === 'string') return <div className={wordClass}>{item}</div>
    return (
        <Link href={item.href} className={`${wordClass} underline-offset-4 hover:underline`}>
            {item.label}
        </Link>
    )
}

// MarqueeComp: A pre-configured marquee component with message and image
export function MarqueeComp({
    message,
    imageSrc,
    imageAnimationClass = 'animation-thumbsUp',
    backgroundColor = 'bg-primary',
}: {
    message?: string | MarqueeItem[]
    imageSrc: string
    imageAnimationClass?: string
    backgroundColor?: string
}) {
    return (
        <div className="border-white shadow">
            <MarqueeWrapper
                backgroundColor={backgroundColor}
                direction="left"
                className="border-y-2 border-border-default"
            >
                {Array.isArray(message)
                    ? message.map((msg, index) => (
                          <div key={index} className="mx-3 inline-flex min-h-12 items-center gap-3 py-2">
                              <MarqueeWord item={msg} />
                              {index < message.length && (
                                  <Image
                                      src={imageSrc}
                                      alt=""
                                      width={32}
                                      height={32}
                                      unoptimized
                                      className={`${imageAnimationClass || ''} ml-2 h-auto w-8`}
                                  />
                              )}
                          </div>
                      ))
                    : message && (
                          <div className="mx-3 inline-flex min-h-12 items-center py-2">
                              <div className={wordClass}>{message}</div>
                              <Image
                                  src={imageSrc}
                                  alt=""
                                  width={32}
                                  height={32}
                                  unoptimized
                                  className={`${imageAnimationClass || ''} ml-2 h-auto w-8`}
                              />
                          </div>
                      )}
            </MarqueeWrapper>
        </div>
    )
}
