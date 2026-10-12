import type { CSSProperties } from 'react'
import { twMerge } from '@/utils/tw'

/**
 * The one Knerd treatment (Konrad, 24 Sep 2026): Knerd Filled in white under
 * a Knerd Outline copy that sits 3px left and 2px up of it, letters and lines
 * packed tight enough to overlap, centred, caps, with the slight per-line tilt
 * of the landing hero artwork. The OG cards read the same values, so a change
 * here is the change everywhere. Tune in the Knerd Tuner first.
 */
export const knerdTitle = {
    letterSpacing: '-0.065em',
    lineHeight: 0.68,
    /** outline position relative to the fill, px */
    outlineOffset: { x: -3, y: -2 },
    outlineScale: 1,
    /** tilt per line, degrees; lines beyond the second are not tilted */
    lineTilt: [-2, 0.5],
    secondLineShift: '0.02em',
} as const

const knerdOutlineTransform = `translate(${knerdTitle.outlineOffset.x}px, ${knerdTitle.outlineOffset.y}px) scale(${knerdTitle.outlineScale})`

const wrapperStyle: CSSProperties = {
    letterSpacing: knerdTitle.letterSpacing,
    lineHeight: knerdTitle.lineHeight,
}

function lineStyle(index: number): CSSProperties | undefined {
    const tilt = knerdTitle.lineTilt[index] ?? 0
    const shift = index === 1 ? knerdTitle.secondLineShift : '0'
    if (!tilt && shift === '0') return undefined
    return { transform: `rotate(${tilt}deg) translateX(${shift})` }
}

/** Break on "\n" to place lines by hand; a plain string wraps as one line. */
function Lines({ text }: { text: string }) {
    return text.split('\n').map((line, i) => (
        <span key={i} className="block" style={lineStyle(i)}>
            {line}
        </span>
    ))
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
        <span className={twMerge('relative inline-block text-center uppercase', className)} style={wrapperStyle}>
            <span className="block font-knerd-filled text-white">
                <Lines text={text} />
            </span>
            <span
                aria-hidden
                className="absolute inset-x-0 top-0 block origin-top-left font-knerd-outline"
                style={offset ? { transform: knerdOutlineTransform } : undefined}
            >
                <Lines text={text} />
            </span>
        </span>
    )
}

Title.displayName = 'Title'

export { Title }
export default Title
