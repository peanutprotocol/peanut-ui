import * as consts from '@/constants'
import * as utils from '@/utils'

interface IConfirmDetailsProps {
    selectedChainID: string
    selectedTokenAddress: string
    tokenAmount: string
    tokenPrice?: number
    title?: string
    data?: any
}

export const ConfirmDetails = ({
    selectedChainID,
    selectedTokenAddress,
    title,
    tokenAmount,
    tokenPrice,
    data,
}: IConfirmDetailsProps) => {
    return (
        <div className="flex w-full max-w-96 flex-col items-center justify-center gap-3">
            {title && <label className="self-start text-h7 font-normal">{title}</label>}
            <div>
                <div className="flex flex-row items-center justify-center gap-2">
                    <img
                        src={
                            data
                                ? data
                                      .find((chain: any) => chain.chainId === selectedChainID)
                                      ?.tokens.find((token: any) =>
                                          utils.compareTokenAddresses(token.address, selectedTokenAddress)
                                      )?.logoURI
                                : consts.peanutTokenDetails
                                      .find((detail) => detail.chainId === selectedChainID)
                                      ?.tokens.find((token) =>
                                          utils.compareTokenAddresses(token.address, selectedTokenAddress)
                                      )?.logoURI
                        }
                        className="h-6 w-6"
                    />
                    <label className="text-h5 sm:text-h3">
                        {utils.formatTokenAmount(Number(tokenAmount))} 
                        {data
                            ? data
                                  .find((chain: any) => chain.chainId === selectedChainID)
                                  ?.tokens.find((token: any) =>
                                      utils.compareTokenAddresses(token.address, selectedTokenAddress)
                                  )?.symbol
                            : consts.peanutTokenDetails
                                  .find((detail) => detail.chainId === selectedChainID)
                                  ?.tokens.find((token) =>
                                      utils.compareTokenAddresses(token.address, selectedTokenAddress)
                                  )?.symbol}
                    </label>
                </div>
                {tokenPrice && (
                    <label className="text-h7 font-bold text-gray-1">
                        $ {utils.formatTokenAmount(Number(tokenAmount) * tokenPrice)}
                    </label>
                )}
            </div>
            <div className="flex flex-row items-center justify-center gap-2">
                <img
                    src={
                        data
                            ? data.find((chain: any) => chain.chainId === selectedChainID)?.icon.url
                            : consts.supportedPeanutChains.find((detail) => detail.chainId === selectedChainID)?.icon
                                  .url
                    }
                    className="h-6 w-6"
                />
                <label className="text-sm font-bold text-gray-1">
                    {data
                        ? data.find((chain: any) => chain.chainId === selectedChainID)?.name
                        : consts.supportedPeanutChains.find((detail) => detail.chainId === selectedChainID)?.name}
                </label>
            </div>
        </div>
    )
}

export default ConfirmDetails
