import { twMerge } from '@/utils/tw'
import { PhoneFrame } from './PhoneFrame'
import type { ShopLockScreenProps } from './starLp.types'

/**
 * The shop's phone on the QR pages: a dark lock screen with a clock and one
 * "payment received" notice. Unbranded on purpose: it is no real app's UI.
 * The page owns the motion (the phone's buzz, the notice's drop) and the
 * size steps of its fold.
 */
export function ShopLockScreen({
    time,
    lang,
    title,
    children,
    className,
    screenClassName,
    noticeClassName,
    titleClassName,
    wrapNotice = (notice) => notice,
}: ShopLockScreenProps) {
    return (
        <PhoneFrame
            className={className}
            screenClassName={twMerge(
                'grid min-h-56 gap-3 bg-gray-950 px-2 py-4 text-center text-foreground-inverse md:min-h-64',
                screenClassName
            )}
        >
            <p className="text-heading-m">{time}</p>
            {wrapNotice(
                <div
                    lang={lang}
                    className={twMerge(
                        'rounded-card bg-background-default p-2 text-left text-body-xs text-foreground-primary',
                        noticeClassName
                    )}
                >
                    <p className={twMerge('font-bold', titleClassName)}>{title}</p>
                    <p>{children}</p>
                </div>
            )}
        </PhoneFrame>
    )
}
