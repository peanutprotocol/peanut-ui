import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import { IconName } from './Icons/Icon'

interface IconStackProps {
    icons: IconName[] | string[]
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
                        `z-[${index}] flex max-h-6 min-h-6 min-w-6 max-w-6 items-center justify-center rounded-full bg-white ring-1 ring-white dark:bg-black dark:ring-black`,
                        iconClassName
                    )}
                >
                    {typeof icon === 'string' ? (
                        <Image
                            src={icon}
                            alt={`icon-${index}`}
                            width={iconSize}
                            height={iconSize}
                            className="min-h-6 min-w-6 rounded-full"
                        />
                    ) : (
                        <Image
                            src={icon}
                            alt={`icon-${index}`}
                            width={iconSize}
                            height={iconSize}
                            className="min-h-6 min-w-6 rounded-full"
                        />
                    )}
                </div>
            ))}
        </div>
    )
}

export default IconStack
