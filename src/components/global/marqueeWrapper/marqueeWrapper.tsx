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
    return (
        <div
            className={
                onClick
                    ? 'max-h-15 mx-auto h-full w-full cursor-pointer items-center italic ' + backgroundColor
                    : 'max-h-15 mx-auto h-full w-full items-center italic ' + backgroundColor
            }
            onClick={onClick}
        >
            <Marquee autoFill speed={30} direction={direction as directionType}>
                <div className="flex flex-row items-center">{children}</div>
            </Marquee>
        </div>
    )
}
