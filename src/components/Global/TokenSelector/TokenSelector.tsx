'use client'

/**
 * token and network selector component
 *
 * allows users to select which token/chain to receive payments on.
 * shows popular networks (arb, base, op, eth) and tokens (usdc, usdt, native).
 *
 * used by: withdraw, claim, and req_pay flows
 *
 * SHAPE (kush ruling 2026-09-21): the trigger is a real `ListItem` with a
 * chevron; the drawer holds the search field ABOVE a CONTENTLESS `Tabs` row, so
 * switching a network tab cannot unmount the field, and the token list is a
 * sibling beneath both — one grouped card, not N solo cards in a gap stack.
 */

import { useTranslations } from 'next-intl'
import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'

import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Section } from '@/components/0_Bruddle/Section'
import { Tabs } from '@/components/0_Bruddle/Tabs'
import DisplayIcon from '@/components/Global/DisplayIcon'
import { SearchInput } from '@/components/SearchInput'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PEANUT_WALLET_TOKEN_DECIMALS,
    PEANUT_WALLET_TOKEN_NAME,
    PEANUT_WALLET_TOKEN_SYMBOL,
} from '@/constants/zerodev.consts'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { type IToken, type IUserBalance } from '@/interfaces/interfaces'
import { areEvmAddressesEqual, getChainName, isNativeCurrency } from '@/utils/general.utils'
import { NATIVE_TOKEN_PROXY_ADDRESS } from '@/utils/token.utils'
import { Drawer, DrawerContent } from '../Drawer'
import EmptyState from '../EmptyStates/EmptyState'
import NetworkListView from './Components/NetworkListView'
import TokenListItem from './Components/TokenListItem'
import {
    RHINO_WITHDRAW_SUPPORTED_TOKENS_BY_CHAIN,
    TOKEN_SELECTOR_COMING_SOON_NETWORKS,
    TOKEN_SELECTOR_POPULAR_NETWORK_IDS,
    TOKEN_SELECTOR_SUPPORTED_NETWORK_IDS,
} from './TokenSelector.consts'

// USDC logo for the hardcoded USDC-on-Arbitrum fallback (when the token list
// hasn't loaded — e.g. demo mode — and cross-chain is disabled).
const USDC_ARBITRUM_LOGO = 'https://assets.coingecko.com/coins/images/33000/thumb/usdc.png?1700119918'

interface NewTokenSelectorProps {
    viewType?: 'withdraw' | 'other' | 'claim' | 'add' | 'req_pay'
    disabled?: boolean
}

const TokenSelector: React.FC<NewTokenSelectorProps> = ({ viewType = 'other', disabled }) => {
    const t = useTranslations('global')
    // check if cross-chain is disabled via maintenance config
    const isXchainWithdrawDisabled = viewType === 'withdraw' && underMaintenanceConfig.disableXchainWithdraw
    const isXchainSendDisabled =
        (viewType === 'claim' || viewType === 'req_pay') && underMaintenanceConfig.disableXchainSend
    // combined flag for any cross-chain disabled state
    const isCrossChainDisabled = isXchainWithdrawDisabled || isXchainSendDisabled

    // When cross-chain withdraw is live, restrict destinations to what Rhino
    // actually supports — the static catalog lists chains/tokens Rhino
    // rejects (e.g. USDC on Scroll → "SCROLL is disabled"). See
    // RHINO_WITHDRAW_SUPPORTED_TOKENS_BY_CHAIN.
    const restrictToRhino = viewType === 'withdraw' && !isXchainWithdrawDisabled
    const isRhinoSupported = useCallback(
        (chainId: string, tokenSymbol: string) =>
            RHINO_WITHDRAW_SUPPORTED_TOKENS_BY_CHAIN[chainId]?.includes(tokenSymbol.toUpperCase()) ?? false,
        []
    )

    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [searchValue, setSearchValue] = useState('')
    const [showNetworkList, setShowNetworkList] = useState(false)
    const [networkSearchValue, setNetworkSearchValue] = useState('')

    const {
        supportedChainsAndTokens,
        setSelectedTokenAddress,
        setSelectedChainID,
        selectedTokenAddress,
        selectedChainID,
    } = useContext(tokenSelectorContext)

    // drawer utility functions
    const openDrawer = useCallback(() => setIsDrawerOpen(true), [])
    const closeDrawer = useCallback(() => {
        setIsDrawerOpen(false)
        setTimeout(() => setSearchValue(''), 200)
    }, [])
    // handles token selection
    const handleTokenSelect = useCallback(
        (balance: IUserBalance) => {
            setSelectedTokenAddress(balance.address)
            setSelectedChainID(String(balance.chainId))
            closeDrawer()
        },
        [closeDrawer, setSelectedTokenAddress, setSelectedChainID]
    )

    // renders network list view
    const handleSearchNetwork = useCallback(() => {
        setShowNetworkList(true)
        setNetworkSearchValue('')
    }, [])

    const handleChainSelectFromList = useCallback(
        (chainId: string) => {
            setSelectedChainID(chainId)
            setSelectedTokenAddress('') // clear selected token when changing network
            setShowNetworkList(false)
        },
        [setSelectedChainID, setSelectedTokenAddress]
    )

    // selected network name memo, being used ui
    const selectedNetworkName = useMemo(() => {
        if (!selectedChainID) return null
        // record first — non-EVM slugs ('solana'/'tron') aren't in the
        // chain-details-backed getChainName lookup
        return (
            supportedChainsAndTokens?.[selectedChainID]?.networkName ||
            getChainName(selectedChainID) ||
            `Chain ${selectedChainID}`
        )
    }, [selectedChainID, supportedChainsAndTokens])

    // trigger display variables - derive from selected token/chain
    let triggerSymbol: string | undefined = undefined
    let triggerChainName: string | undefined = undefined
    let triggerLogoURI: string | undefined = undefined

    if (selectedTokenAddress && selectedChainID) {
        const chainInfo = supportedChainsAndTokens[selectedChainID]
        // areEvmAddressesEqual handles EVM case variance (checksum casing) and
        // native-proxy aliasing but is always false for non-EVM (base58
        // Tron/Solana) selections — without a fallback the button kept showing
        // "Select a token" after picking USDT-Tron / USDT/USDC-Solana. The
        // fallback is EXACT equality on purpose: base58 is case-significant and
        // both operands come from the same registry, so a case-insensitive
        // compare could only ever mask an upstream case-corruption bug, never
        // fix a legitimate mismatch.
        const tokenDetails = chainInfo?.tokens.find(
            (t) => areEvmAddressesEqual(t.address, selectedTokenAddress) || t.address === selectedTokenAddress
        )
        if (tokenDetails && chainInfo) {
            triggerSymbol = tokenDetails.symbol
            triggerLogoURI = tokenDetails.logoURI
            triggerChainName = chainInfo.networkName || `Chain ${selectedChainID}`
        }
    }

    // Withdraw destinations are gated by what Rhino can DELIVER to
    // (RHINO_WITHDRAW_SUPPORTED_TOKENS_BY_CHAIN), not by the wagmi source-chain
    // list — the destination needs no wallet connection or balance reads, and
    // several deliverable chains (Avalanche, Linea, Ink, …) are intentionally
    // not source chains. Names/icons come from supportedChainsAndTokens.
    const allowedChainIds = useMemo(
        () =>
            new Set(
                restrictToRhino
                    ? Object.keys(RHINO_WITHDRAW_SUPPORTED_TOKENS_BY_CHAIN)
                    : TOKEN_SELECTOR_SUPPORTED_NETWORK_IDS
            ),
        [restrictToRhino]
    )

    const popularChainsForTabs = useMemo(() => {
        if (!supportedChainsAndTokens) return []
        return TOKEN_SELECTOR_POPULAR_NETWORK_IDS.map((popularNetwork) => {
            const chain = supportedChainsAndTokens[popularNetwork.chainId]
            // skip if the chain ID isn't in supportedChainsAndTokens
            if (!chain) return null
            // for withdraw, only surface chains Rhino can deliver to
            if (restrictToRhino && !RHINO_WITHDRAW_SUPPORTED_TOKENS_BY_CHAIN[chain.chainId]) return null

            return {
                chainId: chain.chainId,
                name: popularNetwork.name || chain.networkName || `Chain ${chain.chainId}`,
                iconURI: chain.chainIconURI || '',
            }
        }).filter((chain): chain is { chainId: string; name: string; iconURI: string } => Boolean(chain)) // type guard filter nulls
    }, [supportedChainsAndTokens, restrictToRhino])

    // build list of popular tokens (usdc, usdt, native) for display
    const tokensToDisplay = useMemo(() => {
        // USDC on Arbitrum — the always-available token. Uses the loaded token
        // metadata when present, else a hardcoded entry so the selector is never
        // empty (e.g. demo mode, or the token list failing to load).
        const usdcArbitrumEntry = (): IUserBalance => {
            const arbitrumChainId = PEANUT_WALLET_CHAIN.id.toString()
            const usdcToken = supportedChainsAndTokens?.[arbitrumChainId]?.tokens?.find((t) =>
                areEvmAddressesEqual(t.address, PEANUT_WALLET_TOKEN)
            )
            const base = usdcToken ?? {
                address: PEANUT_WALLET_TOKEN,
                name: PEANUT_WALLET_TOKEN_NAME,
                symbol: PEANUT_WALLET_TOKEN_SYMBOL,
                decimals: PEANUT_WALLET_TOKEN_DECIMALS,
                logoURI: USDC_ARBITRUM_LOGO,
            }
            return { ...base, chainId: arbitrumChainId, amount: 0, price: 0, currency: base.symbol, value: '' }
        }

        // when cross-chain is disabled, USDC on Arbitrum is the only allowed token
        if (isCrossChainDisabled) return [usdcArbitrumEntry()]

        const popularSymbolsToFind = ['USDC', 'USDT']
        const createPopularTokenEntry = (token: IToken, chainId: string): IUserBalance => ({
            ...token,
            chainId: chainId,
            amount: 0,
            price: 0,
            currency: token.symbol,
            value: '',
        })

        // helper function to sort tokens by priority: USDC first, native second, USDT third
        const sortTokensByPriority = (tokensToSort: IUserBalance[]): IUserBalance[] => {
            return [...tokensToSort].sort((a, b) => {
                const isANative = isNativeCurrency(a.address)
                const isBNative = isNativeCurrency(b.address)
                const isAUsdc = a.symbol.toUpperCase() === 'USDC'
                const isBUsdc = b.symbol.toUpperCase() === 'USDC'
                const isAUsdt = a.symbol.toUpperCase() === 'USDT'
                const isBUsdt = b.symbol.toUpperCase() === 'USDT'

                // USDC first
                if (isAUsdc && !isBUsdc) return -1
                if (!isAUsdc && isBUsdc) return 1

                // native tokens second
                if (isANative && !isBNative) return -1
                if (!isANative && isBNative) return 1

                // USDT third
                if (isAUsdt && !isBUsdt) return -1
                if (!isAUsdt && isBUsdt) return 1

                // alphabetical for any other tokens
                return a.symbol.localeCompare(b.symbol)
            })
        }

        const buildTokensForChainArray = (chainIds: string[], search?: string): IUserBalance[] => {
            const tokens: IUserBalance[] = []
            if (!supportedChainsAndTokens) return tokens
            // SUBSTRING, not exact match: "usd" has to find USDC and USDT. An
            // address still matches whole — a partial address is noise.
            const query = search?.trim().toLowerCase()

            chainIds.forEach((chainId) => {
                const chainData = supportedChainsAndTokens[chainId]
                if (chainData?.tokens) {
                    const processToken = (token: IToken) => {
                        // withdraw: drop tokens Rhino can't deliver on this chain
                        // (e.g. native POL/xDAI, any token on a disabled chain).
                        if (restrictToRhino && !isRhinoSupported(chainId, token.symbol)) return
                        if (query) {
                            if (
                                token.symbol?.toLowerCase().includes(query) ||
                                token.name?.toLowerCase().includes(query) ||
                                token.address.toLowerCase() === query
                            ) {
                                tokens.push(createPopularTokenEntry(token, chainId))
                            }
                        } else {
                            // no specific symbol filter, add USDC, USDT, Native
                            if (areEvmAddressesEqual(token.address, NATIVE_TOKEN_PROXY_ADDRESS)) {
                                tokens.push(createPopularTokenEntry(token, chainId))
                            } else if (popularSymbolsToFind.includes(token.symbol.toUpperCase())) {
                                tokens.push(createPopularTokenEntry(token, chainId))
                            }
                        }
                    }
                    chainData.tokens.forEach(processToken)
                }
            })
            // Dedupe by address normally; for the Rhino-restricted withdraw list
            // collapse per (symbol, chain) so chains with two same-symbol variants
            // (e.g. native USDC + bridged USDC.e on Optimism) show a single entry —
            // Rhino resolves the token by symbol anyway. Keep the FIRST occurrence
            // (token data lists the native/canonical token before bridged variants).
            const seenKeys = new Set<string>()
            const uniqueTokens = tokens.filter((t) => {
                const key = restrictToRhino
                    ? `${t.symbol.toUpperCase()}-${t.chainId}`
                    : `${t.address.toLowerCase()}-${t.chainId}`
                if (seenKeys.has(key)) return false
                seenKeys.add(key)
                return true
            })
            return sortTokensByPriority(uniqueTokens)
        }

        if (searchValue) {
            // search active: show searched token across all networks selectable
            // in this mode — the Rhino destination set for withdraw (which
            // includes destination-only chains like Linea/Avalanche), the wagmi
            // source list otherwise.
            return buildTokensForChainArray(Array.from(allowedChainIds), searchValue)
        }

        const result = selectedChainID
            ? // specific chain selected: show popular (USDC, USDT, Native) for that chain
              buildTokensForChainArray([selectedChainID])
            : // default: popular tokens on popular chains
              buildTokensForChainArray(popularChainsForTabs.map((pc) => pc.chainId))

        // never leave the selector empty — USDC on Arbitrum is always usable
        return result.length > 0 ? result : [usdcArbitrumEntry()]
    }, [
        searchValue,
        selectedChainID,
        supportedChainsAndTokens,
        popularChainsForTabs,
        isCrossChainDisabled,
        restrictToRhino,
        isRhinoSupported,
        allowedChainIds,
    ])

    const tokenListTitle = useMemo(() => {
        if (isCrossChainDisabled) return t('tokenSelector.availableToken')
        if (searchValue) return t('tokenSelector.searchResults')
        if (selectedChainID && selectedNetworkName)
            return t('tokenSelector.popularTokensOnChain', { chainName: selectedNetworkName })
        return t('tokenSelector.popularTokens')
    }, [isCrossChainDisabled, searchValue, selectedChainID, selectedNetworkName, t])

    // the network tabs (user ruling: Tabs over the tile grid, flagged for
    // the board). '' keeps its meaning — All shows popular tokens across the
    // popular chains. selecting a tab does NOT clear the picked token, same as
    // the old tiles; only the More-networks list path clears it. a chain picked
    // from that list may not be popular, so it gets its own tab, keeping the
    // selection visible. No tab carries `content`: the list below is a sibling,
    // so a tab switch never unmounts the search field above it.
    const activeNetworkTab = selectedChainID || 'all'
    const handleNetworkTabChange = useCallback(
        (value: string) => setSelectedChainID(value === 'all' ? '' : value),
        [setSelectedChainID]
    )

    const chainTabLabel = (name: string, iconURI?: string) => (
        <span className="flex items-center gap-1">
            {iconURI && <DisplayIcon iconUrl={iconURI} altText={name} fallbackName={name} sizeClass="h-4 w-4" />}
            {name}
        </span>
    )
    const isPopularSelected = popularChainsForTabs.some((chain) => chain.chainId === selectedChainID)

    // RESPONSIVE TRIM (kush, 2026-09-21: "only keep entries that can fit based
    // on device/parent-container width"). At 375px the full row — All plus four
    // popular chains, each an icon beside a name — ran past the right edge: the
    // last label was cut mid-word and the track's rounded right end was sliced
    // flat. The row now keeps only what fits. Nothing becomes unreachable: the
    // "More networks" list covers every chain in `allowedChainIds`, which is a
    // superset of these four.
    //
    // It drops ONE tab and measures again, instead of adding up label widths.
    // The browser is the only thing that knows how wide a translated label with
    // an icon really is, and a width table would have to be re-derived per
    // locale — the repo has an i18n overflow gate because of exactly that.
    //
    // Two tabs are never dropped: `All`, the default state, and the selected
    // chain, whose tab is the only thing that shows what is selected. If even
    // those two overflow, the row keeps the scroll it already had — clipping
    // and wrapping are both worse.
    //
    // `popularChainsForTabs` stays the full list everywhere else: dropping a
    // TAB must not change which tokens `All` shows.
    const [tabsRow, setTabsRow] = useState<HTMLDivElement | null>(null)
    // one state, because the two halves are one fact: `dropped` is only an
    // answer to the `width` it was measured against. A bare counter could not
    // be reset on a resize — setting it to 0 when it is already 0 changes
    // nothing, React bails out, and a row that had nothing to drop at 430px
    // stayed overflowing after a shrink to 320px (measured).
    const [fit, setFit] = useState({ width: 0, dropped: 0 })
    const droppedTabCount = fit.dropped
    const droppableTabCount = popularChainsForTabs.length - (isPopularSelected ? 1 : 0)

    const visiblePopularChains = useMemo(() => {
        if (droppedTabCount <= 0) return popularChainsForTabs
        const kept = new Set(popularChainsForTabs.map((chain) => chain.chainId))
        let toDrop = droppedTabCount
        // from the right — the leftmost chains are the most used ones
        for (let i = popularChainsForTabs.length - 1; i >= 0 && toDrop > 0; i--) {
            const { chainId } = popularChainsForTabs[i]
            if (chainId === selectedChainID) continue
            kept.delete(chainId)
            toDrop--
        }
        return popularChainsForTabs.filter((chain) => kept.has(chain.chainId))
    }, [popularChainsForTabs, droppedTabCount, selectedChainID])

    // A REF CALLBACK, not a mount effect. The row is handed to the drawer as
    // `children` and mounted in the DRAWER's own commit — this component does
    // not re-render then, so none of its effects run and an effect-only
    // measurement never sees the row at all. Measured before this was a ref
    // callback: at 375px the row stayed untrimmed and clipped until some
    // unrelated render happened ~800ms later. A ref callback does fire in the
    // commit that attaches the element, and before the browser paints. It only
    // publishes the node — all measuring lives in the one effect below, so a
    // row can never be judged twice and dropped twice for one overflow.
    // Detaching resets the count, so each open re-decides from the full row.
    const attachTabsRow = useCallback((node: HTMLDivElement | null) => {
        setTabsRow(node)
        if (!node) setFit({ width: 0, dropped: 0 })
    }, [])

    // the tablist IS the Tabs primitive's scroll box (track and scroll merged,
    // kush 2026-09-21 — the old wrapper element is gone) — still the element
    // whose overflow decides whether the row clips
    const tabsScrollBox = tabsRow?.querySelector('[role="tablist"]') ?? null

    // Every drop re-renders this component, so the next pass runs here until
    // the row fits. A LAYOUT effect with no dependency list: each intermediate
    // row is measured and replaced before the browser paints, so the row is
    // never seen full and then collapsing, and any other cause of a width
    // change is caught without a dependency list that has to name them all.
    useLayoutEffect(() => {
        if (!tabsScrollBox) return
        const width = tabsScrollBox.clientWidth
        // a different box than the one the current answer was measured against
        // — ask again from the full row
        if (width !== fit.width) {
            setFit({ width, dropped: 0 })
            return
        }
        if (fit.dropped >= droppableTabCount) return
        // The triggers are `shrink-0`, so they never squeeze to fit: they
        // overflow the tablist's own box and its `scrollWidth` reads their
        // full demand. That is what keeps one measurement honest for both
        // jobs — the trim here, and the scroll the row falls back to once
        // there is nothing left to drop.
        // the +1 absorbs sub-pixel rounding, which would drop a tab that fits
        if (tabsScrollBox.scrollWidth > width + 1) setFit({ width, dropped: fit.dropped + 1 })
    })

    // The row's box changes with no render of this component behind it — the
    // viewport rotates, a desktop window narrows. The observer turns that into
    // a render, which the effect above then acts on. It watches the SCROLL BOX
    // and not the tablist: the tablist's width is what the trim itself moves,
    // so watching that would feed back on itself. A same-width notice returns
    // the identical state object, so React bails out and the first, harmless
    // notice on observe costs no render.
    useEffect(() => {
        if (!tabsScrollBox || typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(() => {
            const width = tabsScrollBox.clientWidth
            setFit((current) => (current.width === width ? current : { width, dropped: 0 }))
        })
        observer.observe(tabsScrollBox)
        return () => observer.disconnect()
    }, [tabsScrollBox])

    const networkTabs = [
        { value: 'all', label: t('tokenSelector.allNetworks') },
        ...visiblePopularChains.map((chain) => ({
            value: chain.chainId,
            label: chainTabLabel(chain.name, chain.iconURI),
        })),
        ...(selectedChainID && !isPopularSelected
            ? [{ value: selectedChainID, label: chainTabLabel(selectedNetworkName ?? selectedChainID) }]
            : []),
    ]

    const tokenList =
        tokensToDisplay.length > 0 ? (
            <ListGroup role="listbox" aria-label={t('tokenSelector.selectAToken')}>
                {tokensToDisplay.map((token) => (
                    <TokenListItem
                        key={`${token.address}_${String(token.chainId)}`}
                        balance={token}
                        onClick={() => handleTokenSelect(token)}
                        isSelected={
                            selectedTokenAddress?.toLowerCase() === token.address.toLowerCase() &&
                            selectedChainID === String(token.chainId)
                        }
                    />
                ))}
            </ListGroup>
        ) : searchValue ? (
            <EmptyState
                title={t('tokenSelector.noMatchingTokensTitle')}
                icon="search"
                description={t('tokenSelector.noMatchingTokensDescription')}
            />
        ) : (
            <EmptyState title={t('tokenSelector.noPopularTokensTitle')} icon="star" />
        )

    const tokenBrowser = (
        <div className="flex flex-col gap-4">
            {isCrossChainDisabled ? (
                <Callout priority="attention">{t('tokenSelector.crossChainUnavailable')}</Callout>
            ) : (
                <>
                    {/* the search field lives OUTSIDE the tab row, so switching a
                        network tab can never unmount it */}
                    <div className="sticky -top-1 z-10 bg-background-default py-3">
                        <SearchInput
                            value={searchValue}
                            onChange={setSearchValue}
                            onClear={() => setSearchValue('')}
                            placeholder={t('tokenSelector.searchTokenPlaceholder')}
                        />
                    </div>

                    {/* sponsored fees are a fact worth noticing, not grey fine
                        print — and it sits outside the sticky bar so only the
                        search field follows the scroll */}
                    <Callout priority="info">{t('tokenSelector.sponsoredHint')}</Callout>

                    <Section
                        title={t('tokenSelector.selectANetwork')}
                        trailing={
                            // the wrapper reserves the link's full 44px hit area
                            // (its ::after reaches 14px past the text row) without
                            // stretching the title row
                            <div className="flex min-h-11 shrink-0 items-center">
                                <LinkButton onClick={handleSearchNetwork}>
                                    {t('tokenSelector.moreNetworksTitle')}
                                </LinkButton>
                            </div>
                        }
                    >
                        {/* the ref anchor the responsive trim measures through */}
                        <div ref={attachTabsRow}>
                            <Tabs
                                aria-label={t('tokenSelector.selectANetwork')}
                                value={activeNetworkTab}
                                onValueChange={handleNetworkTabChange}
                                tabs={networkTabs}
                                // the tab COUNT here is decided at runtime by
                                // the trim above, so a content-width track
                                // would end wherever the tabs happen to end
                                // and leave a ragged gap to the container edge.
                                // `track` keeps the pill full width with the
                                // chips content-sized inside it (kush,
                                // 2026-09-21, rejecting `stretch`: it would
                                // hand `All` the same room as `⬡ ARB`).
                                fullWidth="track"
                            />
                        </div>
                    </Section>
                </>
            )}

            <Section title={tokenListTitle}>{tokenList}</Section>
        </div>
    )

    // no-fees hint for withdraw/claim when using the default token. ListItem has
    // a title and a body line and no third — flagged, kept as a helper line
    // under the row (form-field helper anatomy: Body/XS, secondary).
    const showNoFeesHint =
        (viewType === 'withdraw' || viewType === 'claim') &&
        selectedTokenAddress?.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase() &&
        selectedChainID === PEANUT_WALLET_CHAIN.id.toString()

    return (
        <div className="flex flex-col gap-1">
            <ListItem
                position="solo"
                data-testid="token-selector-trigger"
                onClick={openDrawer}
                disabled={disabled}
                chevron
                leading={
                    triggerLogoURI ? (
                        <DisplayIcon
                            iconUrl={triggerLogoURI}
                            altText={`${triggerSymbol} logo`}
                            fallbackName={triggerSymbol ?? ''}
                            sizeClass="size-6"
                        />
                    ) : (
                        // nothing picked yet: the leading slot takes an IconBubble,
                        // which is in the board's leading vocabulary — a bare Icon is not
                        <IconBubble icon="plus" size="xs" color="gray" />
                    )
                }
                title={triggerSymbol || t('tokenSelector.selectAToken')}
                body={triggerChainName}
            />
            {showNoFeesHint && (
                <span className="text-body-xs text-foreground-secondary">{t('tokenSelector.noFeesWithToken')}</span>
            )}

            {/* the boolean is honoured: a drag/Escape/outside-click dismiss must
                run the same close path as the row tap */}
            <Drawer open={isDrawerOpen} onOpenChange={(open) => (open ? setIsDrawerOpen(true) : closeDrawer())}>
                <DrawerContent accessibleTitle={t('tokenSelector.drawerTitle')} className="py-4">
                    {showNetworkList ? (
                        <NetworkListView
                            chains={supportedChainsAndTokens}
                            onSelectChain={handleChainSelectFromList}
                            onBack={() => setShowNetworkList(false)}
                            searchValue={networkSearchValue}
                            setSearchValue={setNetworkSearchValue}
                            selectedChainID={selectedChainID}
                            allowedChainIds={allowedChainIds}
                            comingSoonNetworks={restrictToRhino ? [] : TOKEN_SELECTOR_COMING_SOON_NETWORKS}
                        />
                    ) : (
                        tokenBrowser
                    )}
                </DrawerContent>
            </Drawer>
        </div>
    )
}

export default TokenSelector
