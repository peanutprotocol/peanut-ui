import { tokenSelectorContext } from '@/context'
import { formatTokenAmount } from '@/utils'
import { fetchTokenSymbol } from '@/utils'
import { useContext, useEffect, useState } from 'react'
import Icon from '../../Icon'

interface IAdvancedTokenSelectorButtonProps {
    onClick: () => void
    isVisible: boolean
    tokenLogoUri?: string
    tokenSymbol: string
    tokenBalance?: number
    tokenPrice?: number
    tokenAmount?: string
    tokenUsdValue?: string
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
    tokenUsdValue,
    chainName,
    chainIconUri,
    classNameButton,
    isStatic = false,
    type = 'send',
    onReset,
}: IAdvancedTokenSelectorButtonProps) => {
    const { selectedChainID, selectedTokenAddress } = useContext(tokenSelectorContext)
    const [_tokenSymbol, _setTokenSymbol] = useState<string | undefined>(tokenSymbol)

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
            className={`flex w-full ${!isStatic && ' cursor-pointer '} h-18 flex-row items-center justify-between border border-n-1 px-4 py-2 hover:bg-grey-1/10 dark:border-white ${classNameButton}`}
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
                        {type === 'xchain' && tokenAmount && formatTokenAmount(Number(tokenAmount) ?? 0, 4)}{' '}
                        {_tokenSymbol} on {chainName}
                    </div>

                    {type === 'send' && (
                        <p className="text-xs text-grey-1">
                            Balance:{' '}
                            {tokenUsdValue
                                ? // usd value of token
                                  `$${formatTokenAmount(parseFloat(tokenUsdValue), 2)}`
                                : // format token balance with 4 decimals
                                  `${formatTokenAmount(tokenBalance ?? 0, 4)} ${tokenSymbol}`}
                        </p>
                    )}
                    {tokenAmount && tokenPrice && (
                        <p className="text-xs text-grey-1">
                            ${formatTokenAmount(Number(tokenAmount) * tokenPrice, 4)}
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
