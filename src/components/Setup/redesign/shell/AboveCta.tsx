import type { ReactNode } from 'react'
import { twMerge } from '@/utils/tw'

/**
 * Pins a block inside the white panel so it ends `gap` px above the fixed primary button (mock `.above-cta`):
 * an inline error callout, a note. It never moves the button. Use it as a direct child of SetupScreen.
 */
export function AboveCta({ gap = 24, className, children }: { gap?: number; className?: string; children: ReactNode }) {
    return (
        <div
            className={twMerge('absolute inset-x-[var(--sr-gutter)]', className)}
            style={{ bottom: `calc(100% - var(--sr-panel-to-cta) + ${gap}px)` }}
            data-setup-above-cta
        >
            {children}
        </div>
    )
}
