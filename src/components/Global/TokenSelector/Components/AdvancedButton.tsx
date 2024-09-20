import { useContext, useEffect, useState } from 'react'
import Icon from '../../Icon'
import * as utils from '@/utils'
import * as context from '@/context'
import peanut from '@squirrel-labs/peanut-sdk'
import { useAccount } from 'wagmi'
import { useBalance } from '@/hooks/useBalance'
import Loading from '../../Loading'

interface IAdvancedTokenSelectorButtonProps {
    onClick: () => void
    isVisible: boolean
    tokenLogoUri: string
    tokenSymbol: string
    tokenBalance?: number
    tokenPrice?: number
    tokenAmount?: string
    chainName: string
    chainIconUri: string
    classNameButton?: string
    isStatic?: boolean
    type?: 'xchain' | 'send'
}

export const AdvancedTokenSelectorButton = ({
    onClick,
    isVisible,
    tokenLogoUri,
    tokenSymbol,
    tokenBalance,
    tokenPrice,
    tokenAmount,
    chainName,
    chainIconUri,
    classNameButton,
    isStatic = false,
    type = 'send',
}: IAdvancedTokenSelectorButtonProps) => {
    const { selectedChainID, selectedTokenAddress } = useContext(context.tokenSelectorContext)
    const { address } = useAccount()
    const { hasFetchedBalances } = useBalance()
    const [_tokenBalance, _setTokenBalance] = useState<number | undefined>(tokenBalance)

    const getTokenBalance = async () => {
        const balance = Number(
            await peanut.getTokenBalance({
                chainId: selectedChainID,
                tokenAddress: selectedTokenAddress,
                walletAddress: address ?? '',
            })
        )

        if (balance) {
            _setTokenBalance(balance)
        } else {
            _setTokenBalance(tokenBalance)
        }
    }

    useEffect(() => {
        _setTokenBalance(tokenBalance)
        if ((tokenBalance === 0 || !tokenBalance) && address) {
            getTokenBalance()
        }
    }, [tokenBalance, selectedChainID, selectedTokenAddress, address])

    return (
        // <div
        //     className={`flex w-full max-w-96 ${!isStatic && ' cursor-pointer '} h-14 flex-row items-center justify-between border border-n-1 px-4 py-2 dark:border-white  ${classNameButton}`}
        //     onClick={() => {
        //         !isStatic && onClick()
        //     }}
        // >
        //     <div className="flex w-full flex-row items-center justify-between py-2 text-h7 font-normal ">
        //         <div className="flex flex-row items-center justify-center gap-1">
        //             <div className="relative mr-2 h-6 w-6">
        //                 <img src={tokenLogoUri} className="absolute left-0 top-0 h-6 w-6" alt="logo" />
        //                 <img
        //                     src={chainIconUri}
        //                     className="absolute -top-1 left-3 h-4 w-4 rounded-full" // Adjust `left-3` to control the overlap
        //                     alt="logo"
        //                 />
        //             </div>
        //             <div className="flex flex-col items-center justify-center">
        //                 <div className="">{utils.formatTokenAmount(_tokenBalance ?? 0, 4)}</div>
        //             </div>
        //             <div className="">{tokenSymbol}</div>
        //         </div>
        //         <div className="">{chainName}</div>
        //     </div>
        // </div>
        <div
            className={`flex w-full max-w-96 ${!isStatic && ' cursor-pointer '} border-rounded ring-sm h-18 flex-row items-center justify-between px-4 py-2 hover:bg-n-3/10 ${classNameButton}`}
            onClick={() => {
                !isStatic && onClick()
            }}
        >
            <div className={'flex flex-row items-center justify-center gap-4'}>
                <div className="relative h-8 w-8">
                    <img src={tokenLogoUri} className="absolute left-0 top-0 h-8 w-8" alt="logo" />
                    <img
                        src={chainIconUri}
                        className="absolute -top-2 left-4 h-6 w-6 rounded-full" // Adjust `left-3` to control the overlap
                        alt="logo"
                    />
                </div>
                <div className="flex flex-col items-start justify-center gap-1">
                    <div className="inline-block w-full overflow-hidden overflow-ellipsis whitespace-nowrap text-start text-h8">
                        {type === 'xchain' && tokenAmount && utils.formatTokenAmount(Number(tokenAmount) ?? 0)}{' '}
                        {tokenSymbol} on {chainName}
                    </div>

                    {type === 'send' &&
                        (hasFetchedBalances ? (
                            <p className="text-xs text-gray-1">
                                Balance: {utils.formatTokenAmount(_tokenBalance ?? 0, 4)}
                            </p>
                        ) : address ? (
                            <div className="flex flex-row items-center justify-center gap-1 text-xs text-gray-1">
                                Balance: <Loading className="h-2 w-2" />
                            </div>
                        ) : (
                            <div className="flex flex-row items-center justify-center gap-1 text-xs text-gray-1">
                                Balance: 0
                            </div>
                        ))}
                    {tokenAmount && tokenPrice && (
                        <p className="text-xs text-gray-1">
                            ${utils.formatTokenAmount(Number(tokenAmount ?? 0) * tokenPrice ?? 0, 4)}
                        </p>
                    )}
                </div>
            </div>
            <div className="flex flex-row items-center justify-center gap-2">
                <div className="block">
                    {!isStatic && (
                        <Icon
                            name={'arrow-bottom'}
                            className={`h-12 w-12 transition-transform dark:fill-white ${isVisible ? 'rotate-180 ' : ''}`}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
