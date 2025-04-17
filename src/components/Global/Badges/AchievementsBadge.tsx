import { twMerge } from 'tailwind-merge'
import { Icon, IconName } from '../Icons/Icon'

interface AchievementsBadgeProps {
    icon?: IconName
    size?: 'small' | 'medium' | 'large'
    color?: string
    className?: string
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}

const AchievementsBadge = ({
    icon = 'check',
    size = 'medium',
    color = 'bg-success-3',
    className,
    position = 'top-right',
}: AchievementsBadgeProps) => {
    const getContainerSize = () => {
        switch (size) {
            case 'small':
                return 'size-4'
            case 'medium':
                return 'size-5'
            case 'large':
                return 'size-6'
            default:
                return 'size-5'
        }
    }

    const getIconSize = () => {
        switch (size) {
            case 'small':
                return 8
            case 'medium':
                return 10
            case 'large':
                return 14
            default:
                return 10
        }
    }

    const getPadding = () => {
        switch (size) {
            case 'small':
                return 'p-0.5'
            case 'medium':
                return 'p-1'
            case 'large':
                return 'p-1.5'
            default:
                return 'p-1'
        }
    }

    const getPosition = () => {
        switch (position) {
            case 'top-right':
                return 'right-0 top-0'
            case 'top-left':
                return 'left-0 top-0'
            case 'bottom-right':
                return 'right-0 bottom-0'
            case 'bottom-left':
                return 'left-0 bottom-0'
            default:
                return 'right-0 top-0'
        }
    }

    return (
        <div
            className={twMerge(
                'absolute flex items-center justify-center rounded-full border border-black',
                color,
                getContainerSize(),
                getPadding(),
                getPosition(),
                className
            )}
        >
            <Icon name={icon} size={getIconSize()} />
        </div>
    )
}

export default AchievementsBadge
