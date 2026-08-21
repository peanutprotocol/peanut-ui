/**
 * token list item component for the token selector
 *
 * displays token icon, symbol, chain, and optionally balance/price
 * handles selection state and disabled state for unsupported tokens
 */

import Card from '@/components/Global/Card'
import { type CardPosition } from '@/components/Global/Card/card.utils'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { type IUserBalance } from '@/interfaces/interfaces'
import { formatAmountWithSignificantDigits, formatAmount } from '@/utils/general.utils'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
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
    isEnabled?: boolean
}

const TokenListItem: React.FC<TokenListItemProps> = ({
    balance,
    onClick,
    isSelected,
    position = 'single',
    className,
    isPopularToken = false,
    isEnabled = true,
}) => {
    const t = useTranslations('global')
    const [tokenPlaceholder, setTokenPlaceholder] = useState(false)
    const [chainLogoPlaceholder, setChainLogoPlaceholder] = useState(false)
    const [tokenImageError, setTokenImageError] = useState(false)
    const [chainImageError, setChainImageError] = useState(false)
    const { supportedChainsAndTokens } = useContext(tokenSelectorContext)

    const chainDetails = useMemo(() => {
        const chain = supportedChainsAndTokens[String(balance.chainId)]
        return {
            name: chain?.networkName || `Chain ${balance.chainId}`,
            iconURI: chain?.chainIconURI,
        }
    }, [supportedChainsAndTokens, balance.chainId])

    const formattedBalance = useMemo(() => {
        if (isPopularToken || !balance.amount || typeof balance.decimals === 'undefined') return null
        return formatAmountWithSignificantDigits(balance.amount, 4)
    }, [balance.amount, balance.decimals])

    return (
        <div
            className={twMerge(
                'cursor-pointer rounded-sm shadow-sm',
                isSelected && 'bg-primary-3',
                !isEnabled && 'cursor-not-allowed opacity-70',
                className
            )}
            onClick={isEnabled ? onClick : undefined}
        >
            <Card
                position={position}
                className={twMerge(
                    '!overflow-visible border border-border-default p-4 shadow-4',
                    isSelected ? 'bg-primary-3' : 'bg-background-default',
                    !isEnabled && 'bg-background-disabled'
                )}
                border={true}
            >
                <div className="flex items-center justify-between">
                    <div className="space-x-3 flex items-center">
                        <div className="relative flex-shrink-0">
                            {!balance.logoURI || tokenPlaceholder || tokenImageError ? (
                                <AvatarWithBadge name={balance.symbol} size="extra-small" />
                            ) : (
                                <Image
                                    src={balance.logoURI}
                                    alt={`${balance.symbol} logo`}
                                    width={24}
                                    height={24}
                                    className="rounded-full"
                                    onError={() => {
                                        setTokenPlaceholder(true)
                                        setTokenImageError(true)
                                    }}
                                />
                            )}
                            {chainDetails.iconURI && !chainLogoPlaceholder && !chainImageError && (
                                <div className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-background-disabled dark:border-black dark:bg-grey-1">
                                    <Image
                                        src={chainDetails.iconURI}
                                        alt={`${chainDetails.name} logo`}
                                        width={16}
                                        height={16}
                                        className="rounded-full"
                                        onError={() => {
                                            setChainLogoPlaceholder(true)
                                            setChainImageError(true)
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                        <div className={twMerge('flex flex-col items-start')}>
                            <span className="text-body-m font-semibold text-foreground-primary">{balance.symbol}</span>
                            <span
                                className={
                                    isPopularToken
                                        ? 'text-body-xs font-medium text-foreground-secondary'
                                        : 'ml-1 text-body-s font-medium text-foreground-secondary'
                                }
                            >
                                {t.rich('tokenSelector.onChain', {
                                    chainName: chainDetails.name,
                                    c: (chunks) => <span className="capitalize">{chunks}</span>,
                                })}
                            </span>
                        </div>
                    </div>

                    {!isPopularToken && !!formattedBalance ? (
                        <div className="flex flex-col items-end">
                            <div className="text-body-m font-medium text-foreground-primary">{formattedBalance}</div>
                            <div className="text-body-xs font-normal text-foreground-secondary">
                                {/* token value in usd */}
                                {balance.price && balance.price * Number(formattedBalance) > 0
                                    ? `$ ${formatAmount(balance.price * Number(formattedBalance))}`
                                    : '-'}
                            </div>
                        </div>
                    ) : (
                        (isEnabled || isPopularToken) && (
                            <Icon
                                name="chevron-up"
                                size={24}
                                className="flex-shrink-0 rotate-90 text-foreground-primary"
                            />
                        )
                    )}
                </div>
            </Card>
        </div>
    )
}

export default TokenListItem
