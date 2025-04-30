import Card, { CardPosition } from '@/components/Global/Card'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { IUserBalance } from '@/interfaces'
import { formatAmount } from '@/utils'
import Image from 'next/image'
import React, { useContext, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '../Icons/Icon'

interface TokenListItemProps {
    balance: IUserBalance
    onClick: () => void
    isSelected: boolean
    position?: CardPosition
    className?: string
}

const TokenListItem: React.FC<TokenListItemProps> = ({
    balance,
    onClick,
    isSelected,
    position = 'single',
    className,
}) => {
    const [tokenPlaceholder, setTokenPlaceholder] = useState(false)
    const { supportedSquidChainsAndTokens } = useContext(tokenSelectorContext)

    const chainName = useMemo(() => {
        const chain = supportedSquidChainsAndTokens[String(balance.chainId)]
        return chain?.axelarChainName || chain?.axelarChainName || `Chain ${balance.chainId}`
    }, [supportedSquidChainsAndTokens, balance.chainId])

    const formattedBalance = useMemo(() => {
        if (!balance.amount || !balance.decimals) return null
        const displayDecimals = Math.min(balance.decimals ?? 6, 6)
        const formatted = balance.amount.toFixed(displayDecimals)
        return formatAmount(formatted)
    }, [balance.amount, balance.decimals])

    return (
        <div
            className={twMerge('cursor-pointer rounded-sm shadow-sm', isSelected && 'bg-primary-3', className)}
            onClick={onClick}
        >
            <Card
                position={position}
                className={twMerge(
                    'shadow-4 !overflow-visible border border-black p-4',
                    isSelected ? 'bg-primary-3' : 'bg-white'
                )}
                border={true}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="relative">
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
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="text-base font-semibold text-black">
                                {balance.symbol}
                                <span className="ml-1 text-sm font-medium text-grey-1">
                                    on <span className="capitalize">{chainName}</span>
                                </span>
                            </span>
                            {!!formattedBalance && (
                                <span className="text-xs font-normal text-grey-1">
                                    Balance: {formattedBalance} {balance.symbol}
                                </span>
                            )}
                        </div>
                    </div>
                    <Icon name="chevron-up" size={32} className="h-8 w-8 flex-shrink-0 rotate-90 text-black" />
                </div>
            </Card>
        </div>
    )
}

export default TokenListItem
