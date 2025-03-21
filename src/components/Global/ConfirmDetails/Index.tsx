import { formatAmount } from '@/utils'
import Icon from '../Icon'

interface IConfirmDetailsProps {
    tokenSymbol: string
    tokenIconUri: string
    chainName: string
    chainIconUri: string
    tokenAmount: string
    tokenPrice?: number
    title?: string
    showOnlyUSD?: boolean
}

// @dev TODO: makes no sense to have 1 component thats only used in 1 view. Better to have inline then.
// This component should be used in pay confirm too!
const ConfirmDetails = ({
    tokenSymbol,
    tokenIconUri,
    chainName,
    chainIconUri,
    title,
    tokenAmount,
    tokenPrice,
    showOnlyUSD,
}: IConfirmDetailsProps) => {
    return (
        <div className="flex w-full max-w-96 flex-col items-center justify-center gap-3">
            {title && <label className="self-center text-h7 font-normal">{title}</label>}
            <div>
                {showOnlyUSD ? (
                    <div className="flex flex-col items-center justify-center gap-1">
                        <label className="text-h3 sm:text-h1">${formatAmount(Number(tokenAmount))}</label>
                        <span className="text-sm text-grey-1">From Peanut Wallet</span>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-row items-center justify-center gap-2">
                            {tokenIconUri ? (
                                <img src={tokenIconUri} className="h-6 w-6" />
                            ) : (
                                <Icon name="token_placeholder" className="h-6 w-6" fill="#999" />
                            )}
                            <label className="text-h5 sm:text-h3">
                                {formatAmount(Number(tokenAmount))} {tokenSymbol}
                            </label>
                        </div>
                        {tokenPrice && (
                            <label className="text-h7 font-bold text-grey-1">
                                ${formatAmount(Number(tokenAmount) * tokenPrice)}
                            </label>
                        )}
                    </>
                )}
            </div>
            {!showOnlyUSD && (
                <div className="flex flex-row items-center justify-center gap-2">
                    {chainIconUri ? (
                        <img src={chainIconUri} className="h-6 w-6" />
                    ) : (
                        <Icon name="chain_placeholder" className="h-6 w-6" fill="#999" />
                    )}
                    <label className="text-sm font-bold text-grey-1">{chainName}</label>
                </div>
            )}
        </div>
    )
}

export default ConfirmDetails
