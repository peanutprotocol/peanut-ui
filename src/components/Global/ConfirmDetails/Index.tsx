import { formatTokenAmount } from '@/utils'
import Icon from '../Icon'

interface IConfirmDetailsProps {
    tokenSymbol: string
    tokenIconUri: string
    chainName: string
    chainIconUri: string
    tokenAmount: string
    tokenPrice?: number
    title?: string
}

const ConfirmDetails = ({
    tokenSymbol,
    tokenIconUri,
    chainName,
    chainIconUri,
    title,
    tokenAmount,
    tokenPrice,
}: IConfirmDetailsProps) => {
    return (
        <div className="flex w-full max-w-96 flex-col items-center justify-center gap-3">
            {title && <label className="self-center text-h7 font-normal">{title}</label>}
            <div>
                <div className="flex flex-row items-center justify-center gap-2">
                    {tokenIconUri ? (
                        <img src={tokenIconUri} className="h-6 w-6" />
                    ) : (
                        <Icon name="token_placeholder" className="h-6 w-6" fill="#999" />
                    )}
                    <label className="text-h5 sm:text-h3">
                        {formatTokenAmount(Number(tokenAmount))} {tokenSymbol}
                    </label>
                </div>
                {tokenPrice && (
                    <label className="text-h7 font-bold text-gray-1">
                        $ {formatTokenAmount(Number(tokenAmount) * tokenPrice)}
                    </label>
                )}
            </div>
            <div className="flex flex-row items-center justify-center gap-2">
                {chainIconUri ? (
                    <img src={chainIconUri} className="h-6 w-6" />
                ) : (
                    <Icon name="chain_placeholder" className="h-6 w-6" fill="#999" />
                )}
                <label className="text-sm font-bold text-gray-1">{chainName}</label>
            </div>
        </div>
    )
}

export default ConfirmDetails
