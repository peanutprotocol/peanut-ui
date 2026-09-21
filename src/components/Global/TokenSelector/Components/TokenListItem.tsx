/**
 * token row for the token selector and the recover-funds picker.
 *
 * one real `0_Bruddle/ListItem`: leading = the token logo ALONE (the chain
 * moved to the body line — design.md bans the hand-rolled composite, "no
 * mini-badge overlaid on a logo"), title = symbol, trailing = the wallet
 * balance when `showBalance` is set, plus a check on the selected row.
 *
 * selected = fill + check (kush ruling 2026-09-21): `bg-action-primary` with
 * `text-foreground-over-color-primary` on BOTH text lines and a trailing 20px
 * check, so colour never carries the state on its own (WCAG 1.4.1).
 *
 * The option semantics ride a wrapper element rather than the ListItem:
 * `ListItem` forwards neither `role` nor `aria-selected`, and its own
 * `role="button"` (which `onClick` adds) may not nest inside a `role="option"`.
 * Flagged per design.md law 6 — the fix is `selected` + ARIA on `ListItem`
 * itself, which is a DS primitive change this PR deliberately does not make.
 */

import { ListItem } from '@/components/0_Bruddle/ListItem'
import { type CardPosition } from '@/components/Global/Card/card.utils'
import DisplayIcon from '@/components/Global/DisplayIcon'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { type IUserBalance } from '@/interfaces/interfaces'
import { formatAmount, formatAmountWithSignificantDigits } from '@/utils/general.utils'
import { twMerge } from '@/utils/tw'
import React, { useContext, useMemo } from 'react'
import { Icon } from '../../Icons/Icon'

interface TokenListItemProps {
    balance: IUserBalance
    onClick: () => void
    isSelected: boolean
    position?: CardPosition
    /** show the wallet balance and its usd value in the trailing slot (recover-funds) */
    showBalance?: boolean
}

const TokenListItem: React.FC<TokenListItemProps> = ({
    balance,
    onClick,
    isSelected,
    position = 'single',
    showBalance = false,
}) => {
    const { supportedChainsAndTokens } = useContext(tokenSelectorContext)

    const chainName = useMemo(
        () => supportedChainsAndTokens[String(balance.chainId)]?.networkName || `Chain ${balance.chainId}`,
        [supportedChainsAndTokens, balance.chainId]
    )

    const formattedBalance = useMemo(() => {
        if (!showBalance || !balance.amount || typeof balance.decimals === 'undefined') return null
        return formatAmountWithSignificantDigits(balance.amount, 4)
    }, [showBalance, balance.amount, balance.decimals])

    // one colour for every text line on a filled row; unselected rows inherit
    // the ListItem's own title/body/trailing colours
    const paint = isSelected ? 'text-foreground-over-color-primary' : undefined
    // ListItem only truncates a STRING title, and a filled row needs a node to
    // carry the colour — so the node re-states the board's one-line rule
    // (design.md: "list-item titles are single-line")
    const line = twMerge('block truncate', paint)

    return (
        <div
            role="option"
            aria-selected={isSelected}
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                onClick()
            }}
            className="cursor-pointer focus-visible:outline-[3px] focus-visible:outline-action-focus"
        >
            <ListItem
                position={position}
                className={twMerge(
                    'transition-colors duration-instant active:bg-background-disabled',
                    isSelected && 'bg-action-primary'
                )}
                leading={
                    <DisplayIcon
                        iconUrl={balance.logoURI}
                        altText={`${balance.symbol} logo`}
                        fallbackName={balance.symbol}
                        sizeClass="size-6"
                    />
                }
                title={<span className={line}>{balance.symbol}</span>}
                body={<span className={line}>{chainName}</span>}
                trailing={
                    <>
                        {!!formattedBalance && (
                            <div className="flex flex-col items-end">
                                <span className={twMerge('text-body-m', paint ?? 'text-foreground-primary')}>
                                    {formattedBalance}
                                </span>
                                <span className={twMerge('text-body-xs', paint ?? 'text-foreground-secondary')}>
                                    {/* token value in usd */}
                                    {balance.price && balance.price * Number(formattedBalance) > 0
                                        ? `$ ${formatAmount(balance.price * Number(formattedBalance))}`
                                        : '-'}
                                </span>
                            </div>
                        )}
                        {isSelected && <Icon name="check" size={20} className={paint} />}
                    </>
                }
            />
        </div>
    )
}

export default TokenListItem
