import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { MarqueeItem } from '@/components/Global/MarqueeWrapper/marquee.types'

const wordClass = 'text-lg font-bold uppercase md:text-xl'

// A word is either plain text or a link — the strip looks identical either way,
// so a linked word still reads as part of the run of words.
function MarqueeWord({ item }: { item: MarqueeItem }) {
    if (typeof item === 'string') return <div className={wordClass}>{item}</div>
    return (
        <Link prefetch={false} href={item.href} className={`${wordClass} underline-offset-4 hover:underline`}>
            {item.label}
        </Link>
    )
}

function Track({
    items,
    imageSrc,
    imageAnimationClass,
}: {
    items: MarqueeItem[]
    imageSrc: string
    imageAnimationClass: string
}) {
    return (
        <div className="marquee-track" aria-hidden={undefined}>
            {items.map((item, index) => (
                <div key={index} className="mx-3 inline-flex min-h-12 items-center gap-3 py-2">
                    <MarqueeWord item={item} />
                    <Image
                        src={imageSrc}
                        alt=""
                        width={32}
                        height={32}
                        unoptimized
                        className={`${imageAnimationClass} ml-2 h-auto w-8`}
                    />
                </div>
            ))}
        </div>
    )
}

/**
 * Server-rendered marquee for the landing page.
 *
 * `MarqueeWrapper` wraps react-fast-marquee, which measures in JS and is
 * therefore a client component — and the landing page renders eleven strips,
 * every one of them hydrating and re-rendering with its parent on each scroll
 * frame. This version animates in CSS, so the strips can be built on the server
 * and passed in as a slot. The other pages still use the JS one.
 */
export function MarqueeCss({
    message,
    imageSrc,
    imageAnimationClass = 'animation-thumbsUp',
    backgroundColor = 'bg-secondary-1',
}: {
    message: MarqueeItem[]
    imageSrc: string
    imageAnimationClass?: string
    backgroundColor?: string
}) {
    // ~5s per word approximates react-fast-marquee's 30px/s across the strips
    // this page uses, without needing to measure anything.
    const style = { '--marquee-duration': `${Math.max(message.length, 1) * 5}s` } as CSSProperties

    return (
        <div className="border-y-1 border-white shadow">
            <div className={`border-y-2 border-n-1 ${backgroundColor}`}>
                <div className="marquee-viewport" style={style}>
                    <Track items={message} imageSrc={imageSrc} imageAnimationClass={imageAnimationClass} />
                    <Track items={message} imageSrc={imageSrc} imageAnimationClass={imageAnimationClass} />
                </div>
            </div>
        </div>
    )
}
