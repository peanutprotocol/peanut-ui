import { twMerge } from '@/utils/tw'
import type { ScanLineProps } from './starLp.types'

/**
 * The one scan line of the landing pages: a flat 2px pink bar at the top of a
 * layer the size of its window. The caller moves the layer (translateY) and
 * owns its visibility; the window clips it.
 */
export function ScanLine({ className }: ScanLineProps) {
    return (
        <span aria-hidden className={twMerge('absolute inset-0', className)}>
            <span className="absolute inset-x-0 top-0 h-0.5 bg-background-brand" />
        </span>
    )
}
