import { twMerge } from '@/utils/tw'
import type { PhoneFrameProps } from './starLp.types'

/** A drawn phone for in-code product UI: black bezel, DS hard shadow, 320px wide at most. */
export function PhoneFrame({ children, tilt = 0, screen = 'cream', className, label }: PhoneFrameProps) {
    return (
        <div
            {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
            className={twMerge(
                'star-lp-phone mx-auto w-full max-w-80 border-4 border-border-default bg-background-default p-2 shadow-4',
                className
            )}
            style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
        >
            <div
                className={twMerge(
                    'star-lp-phone-screen flex flex-col gap-2 overflow-hidden p-3 text-left text-foreground-primary',
                    screen === 'cream' ? 'bg-background-page' : 'bg-background-default'
                )}
            >
                {children}
            </div>
        </div>
    )
}
