import type { CSSProperties } from 'react'
import { twMerge } from '@/utils/tw'
import type { WiggleProps } from './starLp.types'

/**
 * A small CSS loop for a doodle or glove (no framer cost). Stops under
 * prefers-reduced-motion. Use on one or two decorations per page, never on copy.
 */
export function Wiggle({ children, kind, delay = 0, className }: WiggleProps) {
    return (
        <span
            className={twMerge('inline-block', kind === 'wobble' ? 'star-lp-wobble' : 'star-lp-bounce', className)}
            style={{ '--wiggle-delay': `${delay}s` } as CSSProperties}
        >
            {children}
        </span>
    )
}
