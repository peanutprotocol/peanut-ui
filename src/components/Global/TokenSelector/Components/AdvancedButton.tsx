import { useContext, useEffect, useState } from 'react'
import Icon from '../../Icon'
import * as utils from '@/utils'
import { fetchTokenSymbol } from '@/utils'
import * as context from '@/context'
import peanut from '@squirrel-labs/peanut-sdk'
import { useAccount } from 'wagmi'
import { useBalance } from '@/hooks/useBalance'
import Loading from '../../Loading'

interface IAdvancedTokenSelectorButtonProps {
    onClick: () => void
    isVisible: boolean
    tokenLogoUri?: string
    tokenSymbol: string
    tokenBalance?: number
    tokenPrice?: number
    tokenAmount?: string
    chainName: string
    chainIconUri?: string
    classNameButton?: string
    isStatic?: boolean
    type?: 'xchain' | 'send'
    onReset?: () => void
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
    onReset,
}: IAdvancedTokenSelectorButtonProps) => {
    const { selectedChainID, selectedTokenAddress } = useContext(context.tokenSelectorContext)
    const { address, isConnected } = useAccount()
    const { hasFetchedBalances } = useBalance()
    const [_tokenBalance, _setTokenBalance] = useState<number | undefined>(tokenBalance)
    const [_tokenSymbol, _setTokenSymbol] = useState<string | undefined>(tokenSymbol)
    const [isFetchingTokenBalance, setIsFetchingTokenBalance] = useState<boolean>(false)

    const getTokenBalance = async () => {
        setIsFetchingTokenBalance(true)
        try {
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
        } finally {
            setIsFetchingTokenBalance(false)
        }
    }

    useEffect(() => {
        if (!isConnected) {
            _setTokenBalance(undefined)
            return
        }

        _setTokenBalance(tokenBalance)
        if ((tokenBalance === 0 || !tokenBalance) && address) {
            getTokenBalance()
        }
    }, [tokenBalance, selectedChainID, selectedTokenAddress, address, isConnected])

    useEffect(() => {
        let isMounted = true
        if (!tokenSymbol) {
            fetchTokenSymbol(selectedTokenAddress, selectedChainID).then((symbol) => {
                if (isMounted) {
                    _setTokenSymbol(symbol)
                }
            })
        } else {
            _setTokenSymbol(tokenSymbol)
        }
        return () => {
            isMounted = false
        }
    }, [tokenSymbol, selectedTokenAddress, selectedChainID])

    return (
        <section
            role="button"
            tabIndex={0}
            aria-label="Open token selector"
            className={`flex w-full max-w-96 ${!isStatic && ' cursor-pointer '} h-18 flex-row items-center justify-between border border-n-1 px-4 py-2 hover:bg-n-3/10 ${classNameButton}`}
            onClick={() => {
                !isStatic && onClick()
            }}
            onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                !isStatic && onClick()
            }}
        >
            <div className={'flex flex-row items-center justify-center gap-4'}>
                <div className="relative h-8 w-8">
                    {tokenLogoUri ? (
                        <img src={tokenLogoUri} className="absolute left-0 top-0 h-8 w-8" alt="logo" />
                    ) : (
                        <Icon name="token_placeholder" className="absolute left-0 top-0 h-8 w-8" fill="#999" />
                    )}
                    {chainIconUri ? (
                        <img
                            src={chainIconUri}
                            className="absolute -top-2 left-4 h-6 w-6 rounded-full" // Adjust `left-3` to control the overlap
                            alt="logo"
                        />
                    ) : (
                        <Icon
                            name="token_placeholder"
                            className="absolute -top-2 left-4 h-6 w-6 rounded-full"
                            fill="#999"
                        />
                    )}
                </div>
                <div className="flex flex-col items-start justify-center gap-1">
                    <div className="inline-block w-full overflow-hidden overflow-ellipsis whitespace-nowrap text-start text-h8">
                        {type === 'xchain' && tokenAmount && utils.formatTokenAmount(Number(tokenAmount) ?? 0, 4)}{' '}
                        {_tokenSymbol} on {chainName}
                    </div>

                    {type === 'send' &&
                        (hasFetchedBalances ? (
                            <p className="text-xs text-gray-1">
                                Balance:{' '}
                                {isFetchingTokenBalance ? (
                                    <Loading className="h-2 w-2" />
                                ) : (
                                    `
                                    ${utils.formatTokenAmount(_tokenBalance ?? 0, 4)} ${tokenSymbol}`
                                )}
                            </p>
                        ) : address || isFetchingTokenBalance ? (
                            <div className="flex flex-row items-center justify-center gap-1 text-xs text-gray-1">
                                Balance: <Loading className="h-2 w-2" />
                            </div>
                        ) : null)}
                    {tokenAmount && tokenPrice && (
                        <p className="text-xs text-gray-1">
                            ${utils.formatTokenAmount(Number(tokenAmount) * tokenPrice, 4)}
                        </p>
                    )}
                </div>
            </div>
            {!isStatic && (
                <div className="flex flex-row items-center justify-center gap-2">
                    {'send' === type && (
                        <button aria-label="Open token selector" className="block">
                            <Icon
                                name={'arrow-bottom'}
                                className={`h-12 w-12 transition-transform dark:fill-white ${isVisible ? 'rotate-180 ' : ''}`}
                            />
                        </button>
                    )}
                    {'xchain' === type && (
                        <button
                            aria-label="Reset token selection"
                            className="block"
                            onClick={(e) => {
                                e.stopPropagation() //don't open modal
                                onReset?.()
                            }}
                            onKeyDown={(e) => {
                                if (e.key !== 'Enter') return
                                e.stopPropagation()
                                onReset?.()
                            }}
                        >
                            <Icon name={'close'} className={`h-10 w-10 transition-transform dark:fill-white`} />
                        </button>
                    )}
                </div>
            )}
        </section>
    )
}
