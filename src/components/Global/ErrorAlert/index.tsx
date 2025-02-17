interface ErrorAlertProps {
    error: string
}

const ErrorAlert = ({ error }: ErrorAlertProps) => {
    return (
        <div className="border border-red/30 bg-red/10 p-2">
            <div className="flex items-start gap-3">
                <div className="flex items-start justify-start gap-2 px-1">
                    <div className="flex-shrink-0">⚠️</div>
                    <div className="min-w-fit text-sm font-normal text-red">Error :</div>
                </div>
                <div className="flex items-start justify-start gap-2">
                    <div className="text-sm font-medium text-red">{error}</div>
                </div>
            </div>
        </div>
    )
}

export default ErrorAlert
