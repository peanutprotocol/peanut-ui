'use client'

/**
 * token and network selector
 *
 * used by: withdraw, claim, and req_pay flows
 *
 * SHAPE (TASK-23392, Hugo-approved version H): two select-look triggers,
 * "Token" then "Network", each opening a drawer. Token comes first; the
 * network drawer lists every network, the ones that do not carry the selected
 * token last and disabled (agreed in Sprint 165 QA: hiding them read as "Tron
 * is not supported"), and picking a token the current network does not carry
 * moves to its default network. The rules live in TokenSelector.utils.ts.
 */

import { useTranslations } from 'next-intl'
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import Badge from '@/components/Global/Badges/Badge'
import { SearchInput } from '@/components/SearchInput'
import { useKillSwitches } from '@/features/kill-switches/useKillSwitches'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { type IToken } from '@/interfaces/interfaces'
import { isNativeCurrency } from '@/utils/general.utils'
import { Drawer, DrawerContent, DrawerTitle } from '../Drawer'
import EmptyState from '../EmptyStates/EmptyState'
import SelectorOptionRow from './Components/SelectorOptionRow'
import SelectorTrigger from './Components/SelectorTrigger'
import {
    RHINO_WITHDRAW_CHAIN_IDS,
    RHINO_WITHDRAW_SUPPORTED_TOKENS_BY_CHAIN,
    TOKEN_SELECTOR_SUPPORTED_NETWORK_IDS,
} from './TokenSelector.consts'
import {
    buildTokenOptions,
    fallbackSelection,
    filterNetworks,
    filterTokenOptions,
    findSelection,
    isFeeFreeRoute,
    networkRowsForToken,
    pickDefaultNetwork,
    splitNetworkBadges,
    WALLET_CHAIN_ID,
    withWalletChain,
    type NetworkOption,
    type TokenOption,
} from './TokenSelector.utils'

// outside withdraw, the selector offers the popular tokens: USDC, USDT and the native token
const POPULAR_SYMBOLS = ['USDC', 'USDT']
// the network drawer gets a search field only when the list is long
const NETWORK_SEARCH_MIN = 7

interface NewTokenSelectorProps {
    viewType?: 'withdraw' | 'other' | 'claim' | 'add' | 'req_pay'
    disabled?: boolean
    /** the selector replaced a pair it does not offer — the screen decides whether the user must confirm */
    onAutoCorrect?: () => void
    /** the user picked a network in the network drawer — an explicit network choice */
    onNetworkSelect?: () => void
}

type DrawerKind = 'token' | 'network'

const TokenSelector: React.FC<NewTokenSelectorProps> = ({
    viewType = 'other',
    disabled,
    onAutoCorrect,
    onNetworkSelect,
}) => {
    const t = useTranslations('global')
    // check if cross-chain is disabled by a kill switch
    const { disableXchainWithdraw, disableXchainSend } = useKillSwitches()
    const isXchainWithdrawDisabled = viewType === 'withdraw' && disableXchainWithdraw
    const isXchainSendDisabled = (viewType === 'claim' || viewType === 'req_pay') && disableXchainSend
    // cross-chain off: USDC on the wallet chain (Arbitrum) is the only pair
    const isLocked = isXchainWithdrawDisabled || isXchainSendDisabled
    // withdraw destinations are what Rhino can DELIVER to, not the wagmi
    // source-chain list (several deliverable chains are not source chains)
    const restrictToRhino = viewType === 'withdraw' && !isXchainWithdrawDisabled

    const {
        supportedChainsAndTokens,
        isLoadingChains,
        setSelectedTokenAddress,
        setSelectedChainID,
        selectedTokenAddress,
        selectedChainID,
    } = useContext(tokenSelectorContext)

    const [openDrawer, setOpenDrawer] = useState<DrawerKind | null>(null)
    // the drawer that is (or was last) open — kept through the close animation
    const [drawerKind, setDrawerKind] = useState<DrawerKind>('token')
    const [searchValue, setSearchValue] = useState('')

    const options = useMemo(() => {
        const chains = withWalletChain(supportedChainsAndTokens)
        const unique = (ids: readonly string[]) => Array.from(new Set([WALLET_CHAIN_ID, ...ids]))
        let chainIds: string[]
        let isAllowed: (chainId: string, token: IToken) => boolean
        if (isLocked) {
            chainIds = [WALLET_CHAIN_ID]
            isAllowed = (chainId, token) => isFeeFreeRoute(chainId, token.address)
        } else if (restrictToRhino) {
            chainIds = unique(RHINO_WITHDRAW_CHAIN_IDS)
            isAllowed = (chainId, token) =>
                !!RHINO_WITHDRAW_SUPPORTED_TOKENS_BY_CHAIN[chainId]?.includes(token.symbol.toUpperCase()) ||
                isFeeFreeRoute(chainId, token.address)
        } else {
            chainIds = unique(TOKEN_SELECTOR_SUPPORTED_NETWORK_IDS)
            isAllowed = (_chainId, token) =>
                POPULAR_SYMBOLS.includes(token.symbol.toUpperCase()) || isNativeCurrency(token.address)
        }
        return buildTokenOptions(chains, chainIds, isAllowed)
    }, [supportedChainsAndTokens, isLocked, restrictToRhino])

    const current = useMemo(
        () => findSelection(options, selectedChainID, selectedTokenAddress),
        [options, selectedChainID, selectedTokenAddress]
    )
    // the selected pair is not offered (a stale pick, the maintenance lock, a
    // sandbox wallet chain): show and store a valid one instead of a blank trigger.
    // Not while the record loads — a partial record would "correct" a valid
    // address-book or back-navigation pick.
    const fallback = useMemo(
        () =>
            current || isLoadingChains
                ? undefined
                : fallbackSelection(options, supportedChainsAndTokens, selectedChainID, selectedTokenAddress),
        [current, isLoadingChains, options, supportedChainsAndTokens, selectedChainID, selectedTokenAddress]
    )
    const shown = current ?? fallback

    const select = useCallback(
        (network: NetworkOption) => {
            setSelectedChainID(network.chainId)
            setSelectedTokenAddress(network.token.address)
        },
        [setSelectedChainID, setSelectedTokenAddress]
    )

    // latest callback without re-running the correction on every parent render
    const onAutoCorrectRef = useRef(onAutoCorrect)
    onAutoCorrectRef.current = onAutoCorrect
    useEffect(() => {
        if (!fallback) return
        select(fallback.network)
        onAutoCorrectRef.current?.()
    }, [fallback, select])

    const open = (kind: DrawerKind) => {
        setSearchValue('')
        setDrawerKind(kind)
        setOpenDrawer(kind)
    }
    const close = () => setOpenDrawer(null)

    const handleTokenSelect = (option: TokenOption) => {
        select(pickDefaultNetwork(option, selectedChainID))
        close()
    }
    const handleNetworkSelect = (network: NetworkOption) => {
        select(network)
        onNetworkSelect?.()
        close()
    }

    const tokenDrawer = () => {
        const visible = filterTokenOptions(options, searchValue)
        return (
            <>
                {/* title and search stay pinned while the list scrolls under them */}
                <div className="sticky top-0 z-10 flex flex-col gap-4 bg-white pb-4">
                    <DrawerTitle>{t('tokenSelector.tokenLabel')}</DrawerTitle>
                    <SearchInput
                        value={searchValue}
                        onChange={setSearchValue}
                        onClear={() => setSearchValue('')}
                        placeholder={t('tokenSelector.searchTokenPlaceholder')}
                    />
                </div>
                {visible.length > 0 ? (
                    <ListGroup role="listbox" aria-label={t('tokenSelector.tokenLabel')}>
                        {visible.map((option) => {
                            const { shown: badges, rest } = splitNetworkBadges(option.networks)
                            return (
                                <SelectorOptionRow
                                    key={option.symbol}
                                    title={option.symbol}
                                    iconUrl={option.logoURI}
                                    isSelected={option.symbol === shown?.option.symbol}
                                    onClick={() => handleTokenSelect(option)}
                                    body={
                                        // `custom`: a network name is a fact with no status, and the
                                        // approved design uses the accent pill (Kushagra, 2026-10-15)
                                        <div className="flex min-w-0 items-center gap-1 overflow-hidden pt-1">
                                            {badges.map((network) => (
                                                <Badge
                                                    key={network.chainId}
                                                    status="custom"
                                                    customText={network.name}
                                                />
                                            ))}
                                            {rest > 0 && <Badge status="custom" customText={`+${rest}`} />}
                                        </div>
                                    }
                                />
                            )
                        })}
                    </ListGroup>
                ) : (
                    <EmptyState
                        icon="search"
                        title={t('tokenSelector.noTokensFoundTitle')}
                        description={t('tokenSelector.noMatchingTokensDescription')}
                    />
                )}
            </>
        )
    }

    const networkDrawer = () => {
        const rows = networkRowsForToken(options, shown?.option)
        const visible = filterNetworks(rows, searchValue)
        const symbol = shown?.option.symbol ?? ''
        return (
            <>
                {/* title and search stay pinned while the list scrolls under them */}
                <div className="sticky top-0 z-10 flex flex-col gap-4 bg-white pb-4">
                    <DrawerTitle>{t('tokenSelector.networkLabel')}</DrawerTitle>
                    {rows.length >= NETWORK_SEARCH_MIN && (
                        <SearchInput
                            value={searchValue}
                            onChange={setSearchValue}
                            onClear={() => setSearchValue('')}
                            placeholder={t('tokenSelector.searchNetworkPlaceholder')}
                        />
                    )}
                </div>
                {visible.length > 0 ? (
                    <ListGroup role="listbox" aria-label={t('tokenSelector.networkLabel')}>
                        {visible.map(({ chainId, name, iconUrl, network }) => (
                            <SelectorOptionRow
                                key={chainId}
                                title={name}
                                iconUrl={iconUrl}
                                isSelected={chainId === shown?.network.chainId}
                                disabled={!network}
                                onClick={() => network && handleNetworkSelect(network)}
                                body={
                                    <div className="flex pt-1">
                                        {!network ? (
                                            <Badge
                                                status="neutral"
                                                customText={t('tokenSelector.tokenNotOnNetwork', { symbol })}
                                            />
                                        ) : network.isFree ? (
                                            // `custom`: "No fee" is a benefit, not a status — the
                                            // accent pill of the approved design (TASK-23392)
                                            <Badge status="custom" customText={t('tokenSelector.noFee')} />
                                        ) : (
                                            <Badge status="pending" customText={t('tokenSelector.networkFee')} />
                                        )}
                                    </div>
                                }
                            />
                        ))}
                    </ListGroup>
                ) : (
                    <EmptyState
                        icon="search"
                        title={t('tokenSelector.noNetworksFoundTitle', { search: searchValue })}
                        description={t('tokenSelector.noNetworksFoundDescription')}
                    />
                )}
            </>
        )
    }

    const placeholder = t('tokenSelector.selectAToken')

    return (
        <div className="flex flex-col gap-4">
            <SelectorTrigger
                id="token-selector-token"
                label={t('tokenSelector.tokenLabel')}
                value={shown?.option.symbol ?? placeholder}
                iconUrl={shown?.option.logoURI}
                disabled={disabled || isLocked}
                onClick={() => open('token')}
                data-testid="token-selector-trigger"
            />
            <SelectorTrigger
                id="token-selector-network"
                label={t('tokenSelector.networkLabel')}
                value={shown?.network.name ?? placeholder}
                iconUrl={shown?.network.iconUrl}
                helper={isLocked ? t('tokenSelector.lockedHint') : undefined}
                disabled={disabled || isLocked || !shown}
                onClick={() => open('network')}
                data-testid="network-selector-trigger"
            />

            {/* a drag/Escape/outside-click dismiss runs the same close path as a row tap */}
            <Drawer open={openDrawer !== null} onOpenChange={(isOpen) => !isOpen && close()}>
                <DrawerContent className="py-4">
                    {/* no gap here: the pinned header's pb-4 is the 16px above the list,
                     * so rows scrolling under it stay covered */}
                    <div className="flex flex-col">{drawerKind === 'token' ? tokenDrawer() : networkDrawer()}</div>
                </DrawerContent>
            </Drawer>
        </div>
    )
}

export default TokenSelector
