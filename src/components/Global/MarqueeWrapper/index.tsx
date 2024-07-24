import Marquee from 'react-fast-marquee'

type directionType = 'left' | 'right' | 'up' | 'down' | undefined

export function MarqueeWrapper({
    children,
    backgroundColor,
    onClick,
    direction = 'left',
    className = 'border-b-2 border-black border',
}: {
    children: React.ReactNode
    backgroundColor: string
    onClick?: () => void
    direction?: string
    className?: string
}) {
    const baseClass = `max-h-18 mx-auto h-full w-full items-center italic  text-black  ${className} ${backgroundColor}`
    const _className = onClick ? `${baseClass} cursor-pointer` : baseClass

    return (
        <div className={_className} onClick={onClick}>
            <Marquee autoFill speed={30} direction={direction as directionType}>
                <div className="flex flex-row items-center">{children}</div>
            </Marquee>
        </div>
    )
}
