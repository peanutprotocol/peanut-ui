import { Icon } from '../Icons/Icon'

interface ErrorAlertProps {
    label?: string
    description: string
}

const ErrorAlert = ({ label, description }: ErrorAlertProps) => {
    return (
        <div className="flex items-start justify-center gap-3 text-error">
            <Icon name="error" className="min-h-4 min-w-4" />
            <div className="text-sm font-medium">{description}</div>
        </div>
    )
}

export default ErrorAlert
