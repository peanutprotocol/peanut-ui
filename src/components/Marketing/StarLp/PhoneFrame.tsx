import { twMerge } from '@/utils/tw'
import type { PhoneFrameProps } from './starLp.types'

/**
 * The one phone outline of the landing pages: black bezel, DS hard shadow,
 * 320px wide at most. Every section that shows a phone uses it; none builds
 * its own bezel.
 */
export function PhoneFrame({
    children,
    tilt = 0,
    screen = 'cream',
    className,
    screenClassName,
    label,
    interactive = false,
}: PhoneFrameProps) {
    // An image's children are presentational, which would hide a link inside it.
    const role = interactive ? 'group' : 'img'
    const a11y = label ? { role, 'aria-label': label } : interactive ? {} : { 'aria-hidden': true }
    return (
        <div
            {...a11y}
            className={twMerge(
                'star-lp-phone mx-auto w-full max-w-80 border-4 border-border-default bg-background-default p-2 shadow-4',
                className
            )}
            style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
        >
            <div
                className={twMerge(
                    'star-lp-phone-screen flex flex-col gap-2 overflow-hidden p-3 text-left text-foreground-primary',
                    screen === 'cream' ? 'bg-background-page' : 'bg-background-default',
                    screenClassName
                )}
            >
                {children}
            </div>
        </div>
    )
}
