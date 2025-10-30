import Image from 'next/image'
import { STAR_STRAIGHT_ICON } from '@/assets'

type PerkIconSize = 'extra-small' | 'small' | 'medium' | 'large'

interface PerkIconProps {
    size?: PerkIconSize
    className?: string
}

const sizeConfig = {
    'extra-small': {
        container: 'h-8 w-8',
        icon: { width: 16, height: 16 },
    },
    small: {
        container: 'h-10 w-10',
        icon: { width: 22, height: 22 },
    },
    medium: {
        container: 'h-12 w-12',
        icon: { width: 28, height: 28 },
    },
    large: {
        container: 'h-16 w-16',
        icon: { width: 36, height: 36 },
    },
}

/**
 * Reusable Perk Icon component
 * Yellow circle background with star icon at consistent proportions
 */
export const PerkIcon: React.FC<PerkIconProps> = ({ size = 'medium', className = '' }) => {
    const config = sizeConfig[size]

    return (
        <div
            className={`flex ${config.container} flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 ${className}`}
        >
            <Image src={STAR_STRAIGHT_ICON} alt="Perk" width={config.icon.width} height={config.icon.height} />
        </div>
    )
}
