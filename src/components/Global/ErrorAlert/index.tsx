import { twMerge } from 'tailwind-merge'
import { Icon } from '../Icons/Icon'

interface ErrorAlertProps {
    className?: HTMLDivElement['className']
    iconSize?: number
    iconClassName?: string
    description: string
}

const ErrorAlert = ({ className, iconSize = 16, description, iconClassName }: ErrorAlertProps) => {
    return (
        <div className={twMerge('flex items-start justify-center gap-3 text-sm font-medium text-error', className)}>
            <Icon name="error" size={iconSize} className={twMerge('mt-0.5 min-w-fit', iconClassName)} />
            <div>{description}</div>
        </div>
    )
}

export default ErrorAlert
