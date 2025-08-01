import Image from 'next/image'
import { twMerge } from 'tailwind-merge'

interface IconStackProps {
    icons: string[]
    iconSize?: number
    iconClassName?: string
}

const IconStack: React.FC<IconStackProps> = ({ icons, iconSize = 24, iconClassName = '' }) => {
    return (
        <div className="flex items-center -space-x-2">
            {icons.map((icon, index) => (
                <div
                    key={index}
                    className={twMerge(
                        `flex max-h-6 min-h-6 min-w-6 max-w-6 items-center justify-center rounded-full bg-white`,
                        iconClassName
                    )}
                    style={{ zIndex: index }}
                >
                    <Image
                        src={icon}
                        alt={`icon-${index}`}
                        width={iconSize}
                        height={iconSize}
                        className="min-h-6 min-w-6 rounded-full"
                    />
                </div>
            ))}
        </div>
    )
}

export default IconStack
