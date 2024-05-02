import * as consts from '@/constants'
import * as utils from '@/utils'

interface IConfirmDetailsProps {
    selectedChainID: string
    selectedTokenAddress: string
    tokenAmount: string
    tokenPrice?: number
    title?: string
}

export const ConfirmDetails = ({
    selectedChainID,
    selectedTokenAddress,
    title,
    tokenAmount,
    tokenPrice,
}: IConfirmDetailsProps) => {
    return (
        <div className="flex w-full max-w-96 flex-col items-center justify-center gap-3">
            {title && <label className="self-start text-h7 font-normal">{title}</label>}
            <div>
                <div className="flex flex-row items-center justify-center gap-2">
                    <img
                        src={
                            consts.peanutTokenDetails
                                .find((detail) => detail.chainId === selectedChainID)
                                ?.tokens.find(
                                    (token) => token.address.toLowerCase() === selectedTokenAddress.toLowerCase()
                                )?.logoURI
                        }
                        className="h-6 w-6"
                    />
                    <label className="text-h3">
                        {utils.formatTokenAmount(Number(tokenAmount))}{' '}
                        {
                            consts.peanutTokenDetails
                                .find((detail) => detail.chainId === selectedChainID)
                                ?.tokens.find(
                                    (token) => token.address.toLowerCase() === selectedTokenAddress.toLowerCase()
                                )?.symbol
                        }
                    </label>
                </div>
                {tokenPrice && (
                    <label className="text-h7 font-bold text-gray-1">
                        ${utils.formatTokenAmount(Number(tokenAmount) * tokenPrice)}
                    </label>
                )}
            </div>
            <div className="flex flex-row items-center justify-center gap-2">
                <img
                    src={consts.supportedPeanutChains.find((detail) => detail.chainId === selectedChainID)?.icon.url}
                    className="h-6 w-6"
                />
                <label className="text-sm font-bold text-gray-1">
                    {consts.supportedPeanutChains.find((detail) => detail.chainId === selectedChainID)?.name}
                </label>
            </div>
        </div>
    )
}

export default ConfirmDetails
