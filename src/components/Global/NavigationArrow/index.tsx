import { Icon } from '@/components/Global/Icons/Icon'
import { twMerge } from 'tailwind-merge'

interface NavigationArrowProps {
    size?: number
    className?: string
}

/**
 * Standard navigation arrow component (chevron pointing right)
 * Used consistently across the app for navigable list items
 */
const NavigationArrow: React.FC<NavigationArrowProps> = ({ size = 24, className }) => {
    return <Icon name="chevron-up" size={size} className={twMerge('rotate-90', className)} />
}

export default NavigationArrow
