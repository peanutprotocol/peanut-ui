'use client'

import Image from 'next/image'
import React, { ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { Button } from '@/components/0_Bruddle'
import Divider from '@/components/0_Bruddle/Divider'
import BottomDrawer from '@/components/Global/BottomDrawer'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { tokenSelectorContext } from '@/context'
import { useDynamicHeight } from '@/hooks/ui/useDynamicHeight'
import { IToken, IUserBalance } from '@/interfaces'
import { areEvmAddressesEqual, formatTokenAmount, isNativeCurrency } from '@/utils'
import { SQUID_ETH_ADDRESS } from '@/utils/token.utils'
import { useAppKit, useAppKitAccount, useDisconnect } from '@reown/appkit/react'
import EmptyState from '../EmptyStates/EmptyState'
import { Icon, IconName } from '../Icons/Icon'
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
import { fetchWalletBalances } from '@/app/actions/tokens'

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
    const drawerHeightVh = useDynamicHeight(contentRef, { maxHeightVh: 90, minHeightVh: 10, extraVhOffset: 5 })
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [searchValue, setSearchValue] = useState('')
    const [showNetworkList, setShowNetworkList] = useState(false)
    const [networkSearchValue, setNetworkSearchValue] = useState('')
    // appkit hooks
    const { open: openAppkitModal } = useAppKit()
    const { disconnect: disconnectWallet } = useDisconnect()
    const { isConnected: isExternalWalletConnected, address: externalWalletAddress } = useAppKitAccount()
    // external wallet balance states
    const [externalBalances, setExternalBalances] = useState<IUserBalance[] | null>(null)
    const [isLoadingExternalBalances, setIsLoadingExternalBalances] = useState(false)
    // refs to track previous state for useEffect logic
    const prevIsExternalConnected = useRef(isExternalWalletConnected)
    const prevExternalAddress = useRef<string | null>(externalWalletAddress ?? null)
    // state for image loading errors
    const [buttonImageError, setButtonImageError] = useState(false)
    const {
        supportedSquidChainsAndTokens,
        setSelectedTokenAddress,
        setSelectedChainID,
        selectedTokenAddress,
        selectedChainID,
        setSelectedTokenBalance,
    } = useContext(tokenSelectorContext)

    // drawer utility functions
    const openDrawer = useCallback(() => setIsDrawerOpen(true), [])
    const closeDrawer = useCallback(() => {
        setIsDrawerOpen(false)
        setTimeout(() => setSearchValue(''), 200)
    }, [])

    // external wallet balance fetching
    useEffect(() => {
        // this effect fetches balances when an external wallet connects,
        // refetches when the address changes while connected,
        // and clears them when it disconnects.
        if (isExternalWalletConnected && externalWalletAddress) {
            // wallet is connected with an address.
            const justConnected = !prevIsExternalConnected.current
            const addressChanged = externalWalletAddress !== prevExternalAddress.current
            if (justConnected || addressChanged || externalBalances === null) {
                // Fetch only if balances are null, not just empty array to prevent loops on 0 balance
                setIsLoadingExternalBalances(true)
                fetchWalletBalances(externalWalletAddress)
                    .then((balances) => {
                        setExternalBalances(balances.balances || [])
                    })
                    .catch((error) => {
                        console.error('Manual balance fetch failed:', error)
                        setExternalBalances([])
                    })
                    .finally(() => {
                        setIsLoadingExternalBalances(false)
                    })
            }
        } else {
            // wallet is not connected
            if (prevIsExternalConnected.current) {
                // wallet was previously connected, now it's not: clear balances.
                setExternalBalances(null)
                setIsLoadingExternalBalances(false)
            }
            // else: wallet was already disconnected - do nothing.
        }

        // update refs for the next render
        prevIsExternalConnected.current = isExternalWalletConnected
        prevExternalAddress.current = externalWalletAddress ?? null
    }, [isExternalWalletConnected, externalWalletAddress])

    const sourceBalances = useMemo(() => {
        if (isExternalWalletConnected && externalBalances !== null) {
            return externalBalances
        } else {
            return [] // return empty array if no source is available
        }
    }, [isExternalWalletConnected, externalBalances])

    const tokensOnSelectedNetwork = useMemo(() => {
        if (!selectedChainID) {
            return sourceBalances // no network selected, return all source balances
        }
        return sourceBalances.filter((balance) => String(balance.chainId) === selectedChainID)
    }, [sourceBalances, selectedChainID, isExternalWalletConnected])

    // display tokens memo, filters tokensOnSelectedNetwork by search value
    const displayUserTokens = useMemo(() => {
        const lowerSearchValue = searchValue.toLowerCase()
        if (!lowerSearchValue) {
            return tokensOnSelectedNetwork // no search value, return all tokens on the network
        }
        return tokensOnSelectedNetwork.filter((balance) => {
            const hasSymbol = !!balance.symbol
            const symbolMatch = hasSymbol && balance.symbol.toLowerCase().includes(lowerSearchValue)
            const nameMatch = balance.name?.toLowerCase().includes(lowerSearchValue) ?? false
            const addressMatch = balance.address?.toLowerCase().includes(lowerSearchValue) ?? false
            return hasSymbol && (symbolMatch || nameMatch || addressMatch)
        })
    }, [tokensOnSelectedNetwork, searchValue, isExternalWalletConnected])

    // handles token selection based on token balance
    const handleTokenSelect = useCallback(
        (balance: IUserBalance) => {
            setSelectedTokenAddress(balance.address)
            setSelectedChainID(String(balance.chainId))
            closeDrawer()
        },
        [closeDrawer, setSelectedTokenAddress, setSelectedChainID]
    )

    useEffect(() => {
        const tokenBalance = sourceBalances.find(
            (balance) =>
                areEvmAddressesEqual(balance.address, selectedTokenAddress) &&
                String(balance.chainId) === selectedChainID
        )
        if (tokenBalance) {
            setSelectedTokenBalance(tokenBalance.amount.toString())
        }
    }, [selectedTokenAddress, selectedChainID, sourceBalances])

    // renders network list view
    const handleSearchNetwork = useCallback(() => {
        setShowNetworkList(true)
        setNetworkSearchValue('')
    }, [])

    const handleChainSelectFromList = useCallback(
        (chainId: string) => {
            setSelectedChainID(chainId)
            if (isExternalWalletConnected) {
                setSelectedTokenAddress('') // clear token when chain changes with external wallet
            } else {
                setSelectedTokenAddress('') // clear selected token when changing network in popular view
            }
            setShowNetworkList(false)
        },
        [setSelectedChainID, setSelectedTokenAddress, isExternalWalletConnected]
    )

    // selected network name memo, being used ui
    const selectedNetworkName = useMemo(() => {
        if (!selectedChainID) return null
        const network = supportedSquidChainsAndTokens[selectedChainID]
        return network?.axelarChainName || `Chain ${selectedChainID}`
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
            chainName: chainInfo.axelarChainName,
            logoURI: token.logoURI,
            chainLogoURI: chainInfo.chainIconURI,
            balance: null,
        }
    }, [supportedSquidChainsAndTokens])

    // button display variables
    let buttonSymbol: string | undefined = undefined
    let buttonChainName: string | undefined = undefined
    let buttonFormattedBalance: string | null = null
    let buttonLogoURI: string | undefined = undefined
    let buttonChainLogoURI: string | undefined = peanutWalletTokenDetails?.chainLogoURI

    if (isExternalWalletConnected) {
        if (selectedTokenAddress && selectedChainID) {
            // wallet connected AND token selected
            const userBalanceDetails = sourceBalances.find(
                (b) => areEvmAddressesEqual(b.address, selectedTokenAddress) && String(b.chainId) === selectedChainID
            )
            const chainInfo = supportedSquidChainsAndTokens[selectedChainID]
            const generalTokenDetails = chainInfo?.tokens.find((t) =>
                areEvmAddressesEqual(t.address, selectedTokenAddress)
            )

            if (generalTokenDetails && chainInfo) {
                buttonSymbol = generalTokenDetails.symbol
                buttonLogoURI = generalTokenDetails.logoURI
                buttonChainName = chainInfo.axelarChainName || `Chain ${selectedChainID}`
                buttonChainLogoURI = chainInfo.chainIconURI
            }
            if (userBalanceDetails) {
                buttonFormattedBalance = formatTokenAmount(userBalanceDetails.amount) ?? null
            } else {
                if (generalTokenDetails) buttonFormattedBalance = '0'
            }
        }
    } else {
        // no external wallet connected
        if (selectedTokenAddress && selectedChainID) {
            // popular token selected by user or "usdc on arb" card clicked
            const chainInfo = supportedSquidChainsAndTokens[selectedChainID]
            const generalTokenDetails = chainInfo?.tokens.find((t) =>
                areEvmAddressesEqual(t.address, selectedTokenAddress)
            )
            if (generalTokenDetails && chainInfo) {
                buttonSymbol = generalTokenDetails.symbol
                buttonLogoURI = generalTokenDetails.logoURI
                buttonChainName = chainInfo.axelarChainName || `Chain ${selectedChainID}`
                buttonChainLogoURI = chainInfo.chainIconURI
            }
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
                name: popularNetwork.name || chain.axelarChainName || `Chain ${chain.chainId}`,
                iconURI: chain.chainIconURI || '',
            }
        }).filter((chain): chain is { chainId: string; name: string; iconURI: string } => Boolean(chain)) // type guard filter nulls
    }, [supportedSquidChainsAndTokens])

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

        if (!isExternalWalletConnected) {
            if (searchValue) {
                // search active: show searched token across ALL supported networks
                return buildTokensForChainArray(TOKEN_SELECTOR_SUPPORTED_NETWORK_IDS, searchValue)
            }
            if (selectedChainID) {
                // specific chain selected: show popular (USDC, USDT, Native) for that chain
                return buildTokensForChainArray([selectedChainID])
            }
            // default for no wallet: popular tokens on popular chains
            const popularChainIds = popularChainsForButtons.map((pc) => pc.chainId)
            return buildTokensForChainArray(popularChainIds)
        }

        return [] // no popular tokens if wallet is connected
    }, [
        isExternalWalletConnected,
        searchValue,
        selectedChainID,
        supportedSquidChainsAndTokens,
        popularChainsForButtons,
    ])

    const filteredPopularTokensToDisplay = useMemo(() => {
        // if searchValue is active, popularTokensList is already filtered by symbol across all chains.
        // if not, popularTokensList is for selected/popular chains, and then we apply broad search.
        if (!searchValue || isExternalWalletConnected) return popularTokensList // no further filtering if search already did its job or wallet connected

        const lowerSearchValue = searchValue.toLowerCase()
        return popularTokensList.filter((token) => {
            const hasSymbol = !!token.symbol
            const symbolMatch = hasSymbol && token.symbol.toLowerCase().includes(lowerSearchValue)
            const nameMatch = token.name?.toLowerCase().includes(lowerSearchValue) ?? false
            const addressMatch = token.address?.toLowerCase().includes(lowerSearchValue) ?? false
            return hasSymbol && (symbolMatch || nameMatch || addressMatch)
        })
    }, [popularTokensList, searchValue, isExternalWalletConnected])

    // visibility flags
    const showPopularTokensList = useMemo(() => !isExternalWalletConnected, [isExternalWalletConnected])
    const showUserTokensList = useMemo(() => isExternalWalletConnected, [isExternalWalletConnected])

    const renderUserTokenListContent = () => {
        if (isLoadingExternalBalances) {
            return <div className="py-4 text-center text-sm text-gray-500">Loading balances...</div>
        }
        // this section only renders if isExternalWalletConnected is true
        if (sourceBalances.length === 0) {
            return (
                <EmptyState
                    title="You have no token balances."
                    icon="txn-off"
                    cta={
                        <Button
                            variant="transparent"
                            className="h-6 text-xs font-normal text-grey-1 underline"
                            onClick={async () => {
                                await disconnectWallet()
                                setTimeout(() => openAppkitModal(), 300)
                            }}
                        >
                            Try connecting to a different wallet.
                        </Button>
                    }
                />
            )
        }
        if (selectedChainID && tokensOnSelectedNetwork.length === 0) {
            return (
                <EmptyState
                    title={
                        <span>
                            You don't have any tokens on <span className="capitalize">{selectedNetworkName}</span>
                        </span>
                    }
                    icon="wallet-cancel"
                    cta={
                        <Button
                            variant="transparent"
                            className="h-6 text-xs font-normal text-grey-1 underline"
                            onClick={() => setSelectedChainID('')}
                        >
                            Show available tokens on other networks
                        </Button>
                    }
                />
            )
        }
        if (searchValue && displayUserTokens.length === 0) {
            return (
                <EmptyState
                    title="No matching tokens found."
                    icon="search"
                    description="Try searching for a different token."
                />
            )
        }
        if (displayUserTokens.length > 0) {
            return displayUserTokens.map((balance) => {
                const isSelected =
                    areEvmAddressesEqual(selectedTokenAddress, balance.address) &&
                    selectedChainID === String(balance.chainId)
                const chainDataFromSquid = supportedSquidChainsAndTokens[String(balance.chainId)]
                const isTokenSupportedBySquid =
                    chainDataFromSquid?.tokens.some((squidToken) =>
                        areEvmAddressesEqual(squidToken.address, balance.address)
                    ) ?? false
                // TODO: remove on coral integration
                // USDT in mainnet is not an erc20 token and needs to have the
                // allowance reseted to 0 before using it. Is not being used
                // currently in prod so we are not investing time in supporting
                // it.
                const isUsdtInMainnet =
                    balance.chainId === '1' &&
                    areEvmAddressesEqual(balance.address, '0xdac17f958d2ee523a2206206994597c13d831ec7')
                return (
                    <TokenListItem
                        key={`${balance.address}_${String(balance.chainId)}_user_balance`}
                        balance={balance}
                        onClick={() => handleTokenSelect(balance)}
                        isSelected={isSelected}
                        isEnabled={isTokenSupportedBySquid && !isUsdtInMainnet}
                    />
                )
            })
        }
        return (
            <EmptyState title="No tokens to display." icon="txn-off" description="Try a different search or network." />
        )
    }

    const currentExpandedHeight = drawerHeightVh ?? 80
    const currentHalfHeight = Math.min(60, drawerHeightVh ?? 60)

    const popularTokensListTitle = useMemo(() => {
        if (searchValue && !isExternalWalletConnected) return 'Search Results'
        if (selectedChainID && selectedNetworkName) return `Popular tokens on ${selectedNetworkName}`
        return 'Popular tokens'
    }, [searchValue, selectedChainID, selectedNetworkName, isExternalWalletConnected])

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

    // auto disconnect external wallet when claim view is active
    useEffect(() => {
        if (isExternalWalletConnected && viewType === 'claim') {
            disconnectWallet()
        }
    }, [isExternalWalletConnected, viewType])

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
                            {buttonFormattedBalance &&
                                (viewType === 'other' || viewType === 'add' || viewType === 'req_pay') && (
                                    <span className="truncate text-xs font-normal text-grey-1">
                                        Balance: {buttonFormattedBalance} {buttonSymbol}
                                    </span>
                                )}
                            {(viewType === 'withdraw' || viewType === 'claim') && // no fees only for default token in these views
                                selectedTokenAddress?.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase() &&
                                selectedChainID === PEANUT_WALLET_CHAIN.id.toString() && (
                                    <span className="text-xs font-normal text-grey-1">No fees with this token.</span>
                                )}
                        </div>
                    </div>
                    <Icon name="chevron-up" size={32} className="h-8 w-8 flex-shrink-0 rotate-90 text-black" />
                </div>
            </Button>

            <BottomDrawer
                isOpen={isDrawerOpen}
                onClose={closeDrawer}
                initialPosition="expanded"
                expandedHeight={currentExpandedHeight}
                halfHeight={currentHalfHeight}
                collapsedHeight={10}
            >
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

                            {/* Popular tokens section - rendered only when there is no wallet connected */}
                            {showPopularTokensList && (
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
                                                    !isExternalWalletConnected &&
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
                            )}

                            {/* USER's wallet tokens section - rendered only when there is a wallet connected */}
                            {showUserTokensList && (
                                <Section
                                    title={
                                        selectedNetworkName ? `Your tokens on ${selectedNetworkName}` : 'Your tokens'
                                    }
                                    className="relative space-y-4"
                                    icon={searchValue ? 'search' : 'wallet-outline'}
                                    titleClassName="text-grey-1 font-medium"
                                >
                                    {selectedNetworkName && isExternalWalletConnected && clearChainSelection()}
                                    <ScrollableList>{renderUserTokenListContent()}</ScrollableList>
                                </Section>
                            )}
                        </div>
                    )}
                </div>
            </BottomDrawer>
        </>
    )
}

export default TokenSelector
