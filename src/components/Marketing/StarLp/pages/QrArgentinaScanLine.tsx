import { twMerge } from '@/utils/tw'

/**
 * The app's scan line: a 2px pink bar with a soft glow at the top of a layer
 * the size of its window. The caller moves the layer (translateY 0 → 100%),
 * and the window clips it. The caller also owns its visibility.
 */
export function QrArgentinaScanLine({ className }: { className?: string }) {
    return (
        <span aria-hidden className={twMerge('absolute inset-0 block', className)}>
            <span className="absolute inset-x-0 top-0 h-[2px] bg-pink-500 shadow-[0_0_8px_2px_var(--color-pink-500)]" />
        </span>
    )
}
