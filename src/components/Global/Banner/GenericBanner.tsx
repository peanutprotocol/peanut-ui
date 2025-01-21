import { MarqueeWrapper } from '../MarqueeWrapper'

interface GenericBannerProps {
    message: string
    backgroundColor?: string
    icon?: string
}

export function GenericBanner({ message, backgroundColor = 'bg-primary-1', icon }: GenericBannerProps) {
    return (
        <MarqueeWrapper backgroundColor={backgroundColor} direction="left">
            <span className="z-10 mx-4 text-sm font-semibold">
                {icon && <span className="mr-2">{icon}</span>}
                {message}
            </span>
        </MarqueeWrapper>
    )
}
