import Card, { CardPosition } from '@/components/Global/Card'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { IUserBalance } from '@/interfaces'
import { formatAmount } from '@/utils'
import Image from 'next/image'
import React, { useContext, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '../../Icons/Icon'

interface TokenListItemProps {
    balance: IUserBalance
    onClick: () => void
    isSelected: boolean
    position?: CardPosition
    className?: string
    isPopularToken?: boolean
}

const TokenListItem: React.FC<TokenListItemProps> = ({
    balance,
    onClick,
    isSelected,
    position = 'single',
    className,
    isPopularToken = false,
}) => {
    const [tokenPlaceholder, setTokenPlaceholder] = useState(false)
    const [chainLogoPlaceholder, setChainLogoPlaceholder] = useState(false)
    const { supportedSquidChainsAndTokens } = useContext(tokenSelectorContext)

    const chainDetails = useMemo(() => {
        const chain = supportedSquidChainsAndTokens[String(balance.chainId)]
        return {
            name: chain?.axelarChainName || `Chain ${balance.chainId}`,
            iconURI: chain?.chainIconURI,
        }
    }, [supportedSquidChainsAndTokens, balance.chainId])

    const formattedBalance = useMemo(() => {
        if (isPopularToken || !balance.amount || typeof balance.decimals === 'undefined') return null
        return formatAmount(balance.amount)
    }, [balance.amount, balance.decimals])

    return (
        <div
            className={twMerge('cursor-pointer rounded-sm shadow-sm', isSelected && 'bg-primary-3', className)}
            onClick={onClick}
        >
            <Card
                position={position}
                className={twMerge(
                    'shadow-4 !overflow-visible border border-black p-4 py-3.5',
                    isSelected ? 'bg-primary-3' : 'bg-white'
                )}
                border={true}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="relative flex-shrink-0">
                            {!balance.logoURI || tokenPlaceholder ? (
                                <Icon name="currency" size={24} />
                            ) : (
                                <Image
                                    src={balance.logoURI}
                                    alt={`${balance.symbol} logo`}
                                    width={24}
                                    height={24}
                                    className="rounded-full"
                                    onError={() => setTokenPlaceholder(true)}
                                />
                            )}
                            {chainDetails.iconURI && !chainLogoPlaceholder && (
                                <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-grey-2 dark:border-black dark:bg-grey-1">
                                    <Image
                                        src={chainDetails.iconURI}
                                        alt={`${chainDetails.name} logo`}
                                        width={16}
                                        height={16}
                                        className="rounded-full"
                                        onError={() => setChainLogoPlaceholder(true)}
                                    />
                                </div>
                            )}
                        </div>
                        <div className={twMerge('flex flex-col items-start')}>
                            <span className="text-base font-semibold text-black">{balance.symbol}</span>
                            <span
                                className={twMerge(
                                    'text-sm font-medium text-grey-1',
                                    isPopularToken ? 'text-xs' : 'ml-1'
                                )}
                            >
                                on <span className="capitalize">{chainDetails.name}</span>
                            </span>
                        </div>
                    </div>

                    {!isPopularToken && !!formattedBalance ? (
                        <div className="flex flex-col items-end">
                            <div className="text-base font-medium text-black">{formattedBalance}</div>
                            <div className="text-xs font-normal text-grey-1">
                                {/* token value in usd */}
                                {balance.price && balance.price * Number(formattedBalance) > 0
                                    ? `$ ${formatAmount(balance.price * Number(formattedBalance))}`
                                    : '-'}
                            </div>
                        </div>
                    ) : (
                        <Icon name="chevron-up" size={32} className="h-8 w-8 flex-shrink-0 rotate-90 text-black" />
                    )}
                </div>
            </Card>
        </div>
    )
}

export default TokenListItem
