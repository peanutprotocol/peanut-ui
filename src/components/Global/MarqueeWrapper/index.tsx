import Marquee from 'react-fast-marquee'

type directionType = 'left' | 'right' | 'up' | 'down' | undefined

export function MarqueeWrapper({
    children,
    backgroundColor,
    onClick,
    direction = 'left',
}: {
    children: React.ReactNode
    backgroundColor: string
    onClick?: () => void
    direction?: string
}) {
    const baseClass = 'max-h-18 mx-auto mt-2 h-full w-full items-center italic ' + backgroundColor
    const className = onClick ? `${baseClass} cursor-pointer` : baseClass

    return (
        <div className={className} onClick={onClick}>
            <Marquee autoFill speed={30} direction={direction as directionType}>
                <div className="flex flex-row items-center">{children}</div>
            </Marquee>
        </div>
    )
}
