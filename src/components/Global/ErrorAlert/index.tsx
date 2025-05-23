import { Icon } from '../Icons/Icon'

interface ErrorAlertProps {
    label?: string
    description: string
}

const ErrorAlert = ({ description }: ErrorAlertProps) => {
    return (
        <div className="flex items-start justify-center gap-3 text-error">
            <Icon name="error" size={16} className="mt-0.5 min-w-fit" />
            <div className="text-sm font-medium">{description}</div>
        </div>
    )
}

export default ErrorAlert
