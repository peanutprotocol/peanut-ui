import * as utils from '@/utils'
interface IConfirmDetailsProps {
    tokenAmount: string
    tokenPrice?: number
    data?: any
}

export const ConfirmCashoutDetails = ({ tokenAmount }: IConfirmDetailsProps) => {
    return (
        <div className="flex w-full max-w-96 flex-col items-center justify-center gap-3">
            <div>
                <div className="flex flex-row items-center justify-center gap-2">
                    <label className="text-h5 sm:text-h3">${utils.formatTokenAmount(Number(tokenAmount))}</label>
                </div>
            </div>
        </div>
    )
}

export default ConfirmCashoutDetails
