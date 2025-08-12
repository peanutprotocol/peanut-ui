import { twMerge } from 'tailwind-merge'
import { MarqueeWrapper } from '../MarqueeWrapper'

interface GenericBannerProps {
    message: string
    backgroundColor?: string
    icon?: string
    marqueeClassName?: string
    messageClassName?: string
}

export function GenericBanner({
    message,
    backgroundColor = 'bg-primary-1',
    icon,
    marqueeClassName,
    messageClassName,
}: GenericBannerProps) {
    return (
        <MarqueeWrapper backgroundColor={backgroundColor} direction="left" className={marqueeClassName}>
            <span className={twMerge('z-10 mx-4 text-sm font-semibold', messageClassName)}>
                {icon && <span className="mr-2">{icon}</span>}
                {message}
            </span>
        </MarqueeWrapper>
    )
}
