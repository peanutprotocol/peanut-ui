interface ErrorAlertProps {
    label?: string
    description: string
}

const ErrorAlert = ({ label, description }: ErrorAlertProps) => {
    return (
        <div className="border border-red/30 bg-red/10 p-2">
            <div className="flex items-start gap-3">
                <div className="flex items-start justify-start gap-2 px-1">
                    <div className="flex-shrink-0">⚠️</div>
                    <div className="min-w-fit text-sm font-normal text-red">{label ? label : 'Error'} :</div>
                </div>
                <div className="flex items-start justify-start gap-2">
                    <div className="text-sm font-medium text-red">{description}</div>
                </div>
            </div>
        </div>
    )
}

export default ErrorAlert
