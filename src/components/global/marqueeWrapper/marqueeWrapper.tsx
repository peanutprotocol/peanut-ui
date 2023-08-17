import Marquee from 'react-fast-marquee'

export function MarqueeWrapper({
    children,
    backgroundColor,
    onClick,
}: {
    children: React.ReactNode
    backgroundColor: string
    onClick?: () => void
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
            <Marquee autoFill speed={30}>
                <div className="flex flex-row items-center">{children}</div>
            </Marquee>
        </div>
    )
}
