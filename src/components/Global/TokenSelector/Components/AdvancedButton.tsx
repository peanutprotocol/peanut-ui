import { useContext, useEffect, useState } from 'react'
import Icon from '../../Icon'
import * as utils from '@/utils'
import * as context from '@/context'
import peanut from '@squirrel-labs/peanut-sdk'
import { useAccount } from 'wagmi'

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
        <div
            className={`flex w-full max-w-96 ${!isStatic && ' cursor-pointer '} h-14 flex-row items-center justify-between border border-n-1 px-4 py-2 dark:border-white  ${classNameButton}`}
            onClick={() => {
                !isStatic && onClick()
            }}
        >
            <div className={'flex flex-row items-center justify-center gap-2'}>
                <img src={tokenLogoUri} alt={''} className="h-6 w-6" />
                <div className="flex flex-col items-start justify-center gap-1">
                    <div className="inline-block w-full overflow-hidden overflow-ellipsis whitespace-nowrap text-start text-h8">
                        {type === 'xchain' && tokenAmount && utils.formatTokenAmount(Number(tokenAmount) ?? 0)}{' '}
                        {tokenSymbol}
                    </div>
                    {type === 'send' && (
                        <p className="text-xs text-gray-1">Balance: {utils.formatTokenAmount(_tokenBalance ?? 0, 4)}</p>
                    )}
                    {tokenAmount && tokenPrice && (
                        <p className="text-xs text-gray-1">
                            ${utils.formatTokenAmount(Number(tokenAmount ?? 0) * tokenPrice ?? 0, 4)}
                        </p>
                    )}
                </div>
            </div>
            <div className="flex flex-row items-center justify-center gap-2">
                <div className="text-h8 text-gray-1 ">{chainName}</div>
                <img src={chainIconUri} alt={''} className="h-6 w-6" />
                <div className="hidden sm:block">
                    {!isStatic && (
                        <Icon
                            name={'arrow-bottom'}
                            className={`transition-transform dark:fill-white ${isVisible ? 'rotate-180 ' : ''}`}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
