import type { CSSProperties } from 'react'
import { twMerge } from '@/utils/tw'

/**
 * The one Knerd treatment: Knerd Filled in white under a Knerd Outline copy
 * that sits a few px up-left of it, letters and lines packed tight enough to
 * overlap, as in the landing hero artwork. The OG cards read the same values,
 * so a change here is the change everywhere. Tune in the Knerd Tuner first.
 */
export const knerdTitle = {
    letterSpacing: '-0.06em',
    lineHeight: 0.76,
    /** outline position relative to the fill, px */
    outlineOffset: { x: -3, y: -2 },
    outlineScale: 1,
} as const

export const knerdOutlineTransform = `translate(${knerdTitle.outlineOffset.x}px, ${knerdTitle.outlineOffset.y}px) scale(${knerdTitle.outlineScale})`

const wrapperStyle: CSSProperties = {
    letterSpacing: knerdTitle.letterSpacing,
    lineHeight: knerdTitle.lineHeight,
}

const Title = ({
    text,
    className,
    offset = true,
}: {
    text: string
    className?: string
    /** false paints the outline exactly on the fill (no up-left misregistration) */
    offset?: boolean
}) => {
    return (
        <span className={twMerge('relative inline-block', className)} style={wrapperStyle}>
            <span className="block font-knerd-filled text-white">{text}</span>
            <span
                aria-hidden
                className="absolute top-0 left-0 block origin-top-left font-knerd-outline"
                style={offset ? { transform: knerdOutlineTransform } : undefined}
            >
                {text}
            </span>
        </span>
    )
}

Title.displayName = 'Title'

export { Title }
export default Title
