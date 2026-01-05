'use client'

/**
 * token and network selector component
 *
 * allows users to select which token/chain to receive payments on.
 * shows popular networks (arb, base, op, eth) and tokens (usdc, usdt, native).
 *
 * used by: withdraw, claim, and req_pay flows
 */

import Image from 'next/image'
import React, { type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { Button } from '@/components/0_Bruddle/Button'
import Divider from '@/components/0_Bruddle/Divider'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { tokenSelectorContext } from '@/context'
import { type IToken, type IUserBalance } from '@/interfaces'
import { areEvmAddressesEqual, isNativeCurrency, getChainName } from '@/utils/general.utils'
import { SQUID_ETH_ADDRESS } from '@/utils/token.utils'
import EmptyState from '../EmptyStates/EmptyState'
import { Icon, type IconName } from '../Icons/Icon'
import NetworkButton from './Components/NetworkButton'
import NetworkListView from './Components/NetworkListView'
import ScrollableList from './Components/ScrollableList'
import SearchInput from './Components/SearchInput'
import TokenListItem from './Components/TokenListItem'
import {
    TOKEN_SELECTOR_COMING_SOON_NETWORKS,
    TOKEN_SELECTOR_POPULAR_NETWORK_IDS,
    TOKEN_SELECTOR_SUPPORTED_NETWORK_IDS,
} from './TokenSelector.consts'
import { Drawer, DrawerContent, DrawerTitle } from '../Drawer'

interface SectionProps {
    title: string
    children: ReactNode
    className?: string
    icon?: IconName
    titleClassName?: string
}

const Section: React.FC<SectionProps> = ({ title, icon, children, className, titleClassName }) => (
    <div className={twMerge('space-y-2', className)}>
        <div className="flex items-center gap-2">
            {icon && <Icon name={icon} size={16} className="text-grey-1" />}
            <h2 className={twMerge('text-md font-bold text-black', titleClassName)}>{title}</h2>
        </div>
        {children}
    </div>
)

interface NewTokenSelectorProps {
    classNameButton?: string
    viewType?: 'withdraw' | 'other' | 'claim' | 'add' | 'req_pay'
    disabled?: boolean
}

const TokenSelector: React.FC<NewTokenSelectorProps> = ({ classNameButton, viewType = 'other', disabled }) => {
    // state to track content height
    const contentRef = useRef<HTMLDivElement>(null)
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [searchValue, setSearchValue] = useState('')
    const [showNetworkList, setShowNetworkList] = useState(false)
    const [networkSearchValue, setNetworkSearchValue] = useState('')

    // state for image loading errors
    const [buttonImageError, setButtonImageError] = useState(false)
    const {
        supportedSquidChainsAndTokens,
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
        return getChainName(selectedChainID) || `Chain ${selectedChainID}`
    }, [selectedChainID, supportedSquidChainsAndTokens])

    const peanutWalletTokenDetails = useMemo(() => {
        if (!supportedSquidChainsAndTokens) return null

        const chainInfo = supportedSquidChainsAndTokens[PEANUT_WALLET_CHAIN.id]
        if (!chainInfo) return null

        const token = chainInfo.tokens.find((t) => areEvmAddressesEqual(t.address, PEANUT_WALLET_TOKEN))
        if (!token) return null
        // Balance for this specific token is not relevant for its display in the "Free transaction token" section
        return {
            symbol: token.symbol,
            chainName: chainInfo.networkName,
            logoURI: token.logoURI,
            chainLogoURI: chainInfo.chainIconURI,
            balance: null,
        }
    }, [supportedSquidChainsAndTokens])

    // button display variables - derive from selected token/chain
    let buttonSymbol: string | undefined = undefined
    let buttonChainName: string | undefined = undefined
    let buttonLogoURI: string | undefined = undefined
    let buttonChainLogoURI: string | undefined = peanutWalletTokenDetails?.chainLogoURI

    if (selectedTokenAddress && selectedChainID) {
        const chainInfo = supportedSquidChainsAndTokens[selectedChainID]
        const tokenDetails = chainInfo?.tokens.find((t) => areEvmAddressesEqual(t.address, selectedTokenAddress))
        if (tokenDetails && chainInfo) {
            buttonSymbol = tokenDetails.symbol
            buttonLogoURI = tokenDetails.logoURI
            buttonChainName = chainInfo.networkName || `Chain ${selectedChainID}`
            buttonChainLogoURI = chainInfo.chainIconURI
        }
    }

    const allowedChainIds = useMemo(() => new Set(TOKEN_SELECTOR_SUPPORTED_NETWORK_IDS), [])

    const popularChainsForButtons = useMemo(() => {
        if (!supportedSquidChainsAndTokens) return []
        return TOKEN_SELECTOR_POPULAR_NETWORK_IDS.map((popularNetwork) => {
            const chain = supportedSquidChainsAndTokens[popularNetwork.chainId]
            // skip if the chain ID from popular list isn't found in squid data
            if (!chain) return null

            return {
                chainId: chain.chainId,
                name: popularNetwork.name || chain.networkName || `Chain ${chain.chainId}`,
                iconURI: chain.chainIconURI || '',
            }
        }).filter((chain): chain is { chainId: string; name: string; iconURI: string } => Boolean(chain)) // type guard filter nulls
    }, [supportedSquidChainsAndTokens])

    // build list of popular tokens (usdc, usdt, native) for display
    const popularTokensList = useMemo(() => {
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

        const buildTokensForChainArray = (chainIds: string[], filterSymbol?: string): IUserBalance[] => {
            const tokens: IUserBalance[] = []
            if (!supportedSquidChainsAndTokens) return tokens

            chainIds.forEach((chainId) => {
                const chainData = supportedSquidChainsAndTokens[chainId]
                if (chainData?.tokens) {
                    const processToken = (token: IToken) => {
                        if (filterSymbol) {
                            if (
                                token.symbol.toUpperCase() === filterSymbol.toUpperCase() ||
                                token.address.toLowerCase() === filterSymbol.toLowerCase() ||
                                token.name?.toLowerCase() === filterSymbol.toLowerCase()
                            ) {
                                tokens.push(createPopularTokenEntry(token, chainId))
                            }
                        } else {
                            // no specific symbol filter, add USDC, USDT, Native
                            if (areEvmAddressesEqual(token.address, SQUID_ETH_ADDRESS)) {
                                tokens.push(createPopularTokenEntry(token, chainId))
                            } else if (popularSymbolsToFind.includes(token.symbol.toUpperCase())) {
                                tokens.push(createPopularTokenEntry(token, chainId))
                            }
                        }
                    }
                    chainData.tokens.forEach(processToken)
                }
            })
            const uniqueTokens = Array.from(
                new Map(tokens.map((t) => [`${t.address.toLowerCase()}-${t.chainId}`, t])).values()
            )
            return sortTokensByPriority(uniqueTokens)
        }

        if (searchValue) {
            // search active: show searched token across ALL supported networks
            return buildTokensForChainArray(TOKEN_SELECTOR_SUPPORTED_NETWORK_IDS, searchValue)
        }
        if (selectedChainID) {
            // specific chain selected: show popular (USDC, USDT, Native) for that chain
            return buildTokensForChainArray([selectedChainID])
        }
        // default: popular tokens on popular chains
        const popularChainIds = popularChainsForButtons.map((pc) => pc.chainId)
        return buildTokensForChainArray(popularChainIds)
    }, [searchValue, selectedChainID, supportedSquidChainsAndTokens, popularChainsForButtons])

    // filter popular tokens by search
    const filteredPopularTokensToDisplay = useMemo(() => {
        if (!searchValue) return popularTokensList

        const lowerSearchValue = searchValue.toLowerCase()
        return popularTokensList.filter((token) => {
            const hasSymbol = !!token.symbol
            const symbolMatch = hasSymbol && token.symbol.toLowerCase().includes(lowerSearchValue)
            const nameMatch = token.name?.toLowerCase().includes(lowerSearchValue) ?? false
            const addressMatch = token.address?.toLowerCase().includes(lowerSearchValue) ?? false
            return hasSymbol && (symbolMatch || nameMatch || addressMatch)
        })
    }, [popularTokensList, searchValue])

    const popularTokensListTitle = useMemo(() => {
        if (searchValue) return 'Search Results'
        if (selectedChainID && selectedNetworkName) return `Popular tokens on ${selectedNetworkName}`
        return 'Popular tokens'
    }, [searchValue, selectedChainID, selectedNetworkName])

    const handleClearSelectedToken = useCallback(() => {
        setSelectedChainID('')
    }, [setSelectedChainID])

    const clearChainSelection = () => {
        return (
            <div className="absolute -top-4 right-0">
                <Button variant="transparent" className="h-fit w-fit p-0" onClick={handleClearSelectedToken}>
                    <div className="flex size-6 items-center justify-center">
                        <Icon name="cancel" className="h-4 w-4" />
                    </div>
                </Button>
            </div>
        )
    }

    return (
        <>
            <Button
                variant="stroke"
                onClick={openDrawer}
                className={twMerge(
                    'flex min-h-16 w-full items-center justify-between bg-white p-4 hover:bg-white hover:text-black',
                    classNameButton
                )}
                shadowSize="4"
                disabled={disabled}
            >
                <div className="flex flex-grow items-center justify-between gap-3 overflow-hidden">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className="relative flex-shrink-0">
                            {buttonLogoURI && !buttonImageError ? (
                                <Image
                                    src={buttonLogoURI}
                                    alt={`${buttonSymbol} logo`}
                                    width={24}
                                    height={24}
                                    className="rounded-full"
                                    onError={() => setButtonImageError(true)}
                                />
                            ) : (
                                <Icon name="plus" size={24} />
                            )}
                            {buttonChainLogoURI && buttonLogoURI && (
                                <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-grey-2 dark:border-black dark:bg-grey-1">
                                    <Image
                                        src={buttonChainLogoURI}
                                        alt={`Chain logo`}
                                        width={16}
                                        height={16}
                                        className="rounded-full"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col items-start overflow-hidden">
                            <span className="truncate text-base font-semibold text-black">
                                {buttonSymbol || 'Select a token'}
                                {buttonChainName && (
                                    <span className="ml-1 text-sm font-medium text-grey-1">
                                        on <span className="capitalize">{buttonChainName}</span>
                                    </span>
                                )}
                            </span>
                            {/* no fees hint for withdraw/claim when using default token */}
                            {(viewType === 'withdraw' || viewType === 'claim') &&
                                selectedTokenAddress?.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase() &&
                                selectedChainID === PEANUT_WALLET_CHAIN.id.toString() && (
                                    <span className="text-xs font-normal text-grey-1">No fees with this token.</span>
                                )}
                        </div>
                    </div>
                    <Icon name="chevron-up" size={32} className="h-8 w-8 flex-shrink-0 rotate-90 text-black" />
                </div>
            </Button>

            <Drawer open={isDrawerOpen} onOpenChange={closeDrawer}>
                <DrawerContent className="p-5">
                    <DrawerTitle className="sr-only">Select Token and Network</DrawerTitle>
                    <div ref={contentRef} className="mx-auto md:max-w-2xl">
                        {showNetworkList ? (
                            <NetworkListView
                                chains={supportedSquidChainsAndTokens}
                                onSelectChain={handleChainSelectFromList}
                                onBack={() => setShowNetworkList(false)}
                                searchValue={networkSearchValue}
                                setSearchValue={setNetworkSearchValue}
                                selectedChainID={selectedChainID}
                                allowedChainIds={allowedChainIds}
                                comingSoonNetworks={TOKEN_SELECTOR_COMING_SOON_NETWORKS}
                            />
                        ) : (
                            <div className="relative flex flex-col space-y-4">
                                {/* Popular chains section - rendered for all views */}
                                <>
                                    <Section title="Select a network">
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-stretch justify-between space-x-2">
                                                {popularChainsForButtons.map((chain) => (
                                                    <NetworkButton
                                                        key={chain.chainId}
                                                        chainName={chain.name}
                                                        chainIconURI={chain.iconURI}
                                                        onClick={() => {
                                                            if (selectedChainID === chain.chainId) {
                                                                setSelectedChainID('') // clear selection if already selected
                                                            } else {
                                                                setSelectedChainID(chain.chainId) //otherwise, select it
                                                            }
                                                        }}
                                                        isSelected={chain.chainId === selectedChainID}
                                                    />
                                                ))}
                                                <NetworkButton
                                                    chainName="Search"
                                                    isSearch={true}
                                                    onClick={handleSearchNetwork}
                                                />
                                            </div>
                                        </div>
                                    </Section>
                                    <Divider className="p-0" dividerClassname="border-grey-1" />
                                </>

                                <div className="sticky -top-1 z-10 space-y-2 bg-background py-3">
                                    <SearchInput
                                        value={searchValue}
                                        onChange={setSearchValue}
                                        onClear={() => setSearchValue('')}
                                        placeholder="Search for a token or paste address"
                                    />
                                    <div className="flex items-center justify-center gap-2">
                                        <Icon name="info" size={10} className="text-grey-1" />
                                        <span className="text-xs font-normal text-grey-1">
                                            Transactions using USDC on Arbitrum are sponsored
                                        </span>
                                    </div>
                                </div>

                                {/* Popular tokens section */}
                                <Section
                                    title={popularTokensListTitle}
                                    icon={searchValue ? 'search' : 'star'}
                                    titleClassName="text-grey-1 font-medium"
                                    className="relative space-y-4"
                                >
                                    {selectedNetworkName && clearChainSelection()}
                                    <ScrollableList>
                                        {filteredPopularTokensToDisplay.length > 0 ? (
                                            filteredPopularTokensToDisplay.map((token) => {
                                                const isSelected =
                                                    selectedTokenAddress?.toLowerCase() ===
                                                        token.address.toLowerCase() &&
                                                    selectedChainID === String(token.chainId)

                                                return (
                                                    <TokenListItem
                                                        key={`${token.address}_${String(token.chainId)}_popular`}
                                                        balance={token}
                                                        onClick={() => handleTokenSelect(token)}
                                                        isSelected={isSelected}
                                                        isPopularToken={true}
                                                    />
                                                )
                                            })
                                        ) : searchValue ? (
                                            <EmptyState
                                                title="No matching popular tokens found"
                                                icon="search"
                                                description="Try searching for a different token"
                                            />
                                        ) : (
                                            <EmptyState title="No popular tokens available" icon="star" />
                                        )}
                                    </ScrollableList>
                                </Section>
                            </div>
                        )}
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    )
}

export default TokenSelector
