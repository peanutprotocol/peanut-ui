'use client'

import Image from 'next/image'
import React, { ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { Button } from '@/components/0_Bruddle'
import Divider from '@/components/0_Bruddle/Divider'
import BottomDrawer from '@/components/Global/BottomDrawer'
import Card from '@/components/Global/Card'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { tokenSelectorContext } from '@/context'
import { useDynamicHeight } from '@/hooks/ui/useDynamicHeight'
import { IToken, IUserBalance } from '@/interfaces'
import { areEvmAddressesEqual, fetchWalletBalances, formatAmount, isNativeCurrency } from '@/utils'
import { NATIVE_TOKEN_ADDRESS, SQUID_ETH_ADDRESS } from '@/utils/token.utils'
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
    viewType?: 'withdraw' | 'other' | 'claim'
}

const TokenSelector: React.FC<NewTokenSelectorProps> = ({ classNameButton, viewType = 'other' }) => {
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

    // external wallet balance fetching
    useEffect(() => {
        // this effect fetches balances when an external wallet connects,
        // refetches when the address changes while connected,
        // and clears them when it disconnects.
        if (isExternalWalletConnected && externalWalletAddress) {
            // wallet is connected with an address.
            const justConnected = !prevIsExternalConnected.current
            const addressChanged = externalWalletAddress !== prevExternalAddress.current

            if (justConnected || addressChanged || !externalBalances) {
                // fetch balances if:
                // 1. wallet just connected OR
                // 2. address changed while connected OR
                // 3. balances are empty/null (prevents empty state loops)
                setIsLoadingExternalBalances(true)

                fetchWalletBalances(externalWalletAddress)
                    .then((balances) => {
                        if (balances.balances && balances.balances.length > 0) {
                            setExternalBalances(balances.balances)
                        } else {
                            console.log('Wallet balances fetch returned empty array', balances)
                            // Set empty array instead of null to prevent refetch loops
                            setExternalBalances([])
                        }
                    })
                    .catch((error) => {
                        console.error('Manual balance fetch failed:', error)
                        setExternalBalances([])
                    })
                    .finally(() => {
                        setIsLoadingExternalBalances(false)
                    })
            }
            // else: wallet is connected, address is the same as last check - do nothing.
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

    // memoize the list of tokens filtered only by the selected network
    const tokensOnSelectedNetwork = useMemo(() => {
        if (!selectedChainID) {
            return sourceBalances // no network selected, return all source balances
        }
        return sourceBalances.filter((balance) => String(balance.chainId) === selectedChainID)
    }, [sourceBalances, selectedChainID, isExternalWalletConnected])

    // display tokens memo, filters tokensOnSelectedNetwork by search value
    const displayTokens = useMemo(() => {
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
            const addressToSet = balance.address
            const chainIdToSet = String(balance.chainId)

            setSelectedTokenAddress(addressToSet)
            setSelectedChainID(chainIdToSet)

            closeDrawer()
        },
        [closeDrawer, setSelectedTokenAddress, setSelectedChainID]
    )

    // handles network selection from the quick "Popular Network" buttons
    const handlePopularNetworkSelection = useCallback(
        (chain: { chainId: string; name: string; iconURI: string }) => {
            setSelectedChainID(chain.chainId)
            setSelectedTokenAddress('')
        },
        [setSelectedChainID, setSelectedTokenAddress]
    )

    // handles default chain/token selection - USDC on arb
    const handleDefaultTokenSelect = useCallback(() => {
        setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())

        closeDrawer()
    }, [closeDrawer, setSelectedTokenAddress, setSelectedChainID])

    // renders network list view
    const handleSearchNetwork = useCallback(() => {
        setShowNetworkList(true)
        setNetworkSearchValue('')
    }, [])

    // handles chain selection from the detailed NetworkListView
    const handleChainSelect = useCallback(
        (chainId: string) => {
            let firstTokenAddressWithBalance: string | undefined = undefined

            const tokenWithBalance = sourceBalances.find(
                (balance) => String(balance.chainId) === chainId && balance.amount > 0
            )
            firstTokenAddressWithBalance = tokenWithBalance?.address

            setSelectedChainID(chainId)
            setSelectedTokenAddress(firstTokenAddressWithBalance ?? NATIVE_TOKEN_ADDRESS)
            setShowNetworkList(false)
        },
        [setSelectedChainID, setSelectedTokenAddress, isExternalWalletConnected, externalBalances, sourceBalances]
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

        // check if we have a balance for this token
        let balance: string | null = null

        // first check external wallet balances
        if (isExternalWalletConnected && externalBalances) {
            const externalTokenBalance = externalBalances.find(
                (b) =>
                    areEvmAddressesEqual(b.address, PEANUT_WALLET_TOKEN) &&
                    String(b.chainId) === PEANUT_WALLET_CHAIN.id.toString()
            )

            if (externalTokenBalance) {
                balance = formatAmount(
                    externalTokenBalance.amount.toFixed(Math.min(externalTokenBalance.decimals ?? 6, 6))
                )
            }
        }

        return {
            symbol: token.symbol,
            chainName: chainInfo.axelarChainName,
            logoURI: token.logoURI,
            chainLogoURI: chainInfo.chainIconURI,
            balance: balance,
        }
    }, [supportedSquidChainsAndTokens, isExternalWalletConnected, externalBalances])

    // set default token on component initialization to peanut wallet token
    useEffect(() => {
        if (!selectedTokenAddress && !selectedChainID && peanutWalletTokenDetails) {
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
        }
    }, [selectedTokenAddress, selectedChainID, peanutWalletTokenDetails, setSelectedTokenAddress, setSelectedChainID])

    // button display variables with defaults from peanut wallet token
    let buttonSymbol: string | undefined = peanutWalletTokenDetails?.symbol
    let buttonChainName: string | undefined = peanutWalletTokenDetails?.chainName
    let buttonFormattedBalance: string | null = peanutWalletTokenDetails?.balance || null
    let buttonLogoURI: string | undefined = peanutWalletTokenDetails?.logoURI

    // handles button display details based on token and chain selection
    // only update button display if a token is actually selected
    if (selectedTokenAddress && selectedChainID) {
        // check if we're using the default Peanut wallet token
        const isDefaultPeanutToken =
            areEvmAddressesEqual(selectedTokenAddress, PEANUT_WALLET_TOKEN) &&
            selectedChainID === PEANUT_WALLET_CHAIN.id.toString()

        if (!isDefaultPeanutToken) {
            const chainInfo = supportedSquidChainsAndTokens[selectedChainID]
            // find general token details from static list first
            const generalTokenDetails = chainInfo?.tokens.find((t) =>
                areEvmAddressesEqual(t.address, selectedTokenAddress)
            )

            // prioritize static data for symbol, logo, and chain name
            if (generalTokenDetails && chainInfo) {
                buttonSymbol = generalTokenDetails.symbol
                buttonLogoURI = generalTokenDetails.logoURI
                buttonChainName = chainInfo.axelarChainName || `Chain ${selectedChainID}`
            } else {
                // fallback if static data not found (should be rare)
                buttonSymbol = peanutWalletTokenDetails?.symbol
                buttonChainName = peanutWalletTokenDetails?.chainName
                buttonLogoURI = peanutWalletTokenDetails?.logoURI
            }

            // check user balance *only* for the amount
            const userBalanceDetails = sourceBalances?.find(
                (b) => areEvmAddressesEqual(b.address, selectedTokenAddress) && String(b.chainId) === selectedChainID
            )

            if (userBalanceDetails) {
                // we have a balance, format and display it
                buttonFormattedBalance = formatAmount(userBalanceDetails.amount)
            } else {
                // no balance found for this specific token/chain
                buttonFormattedBalance = null
            }
        }
    }

    // allowed chain ids memo, using the supported network ids mapping
    const allowedChainIds = useMemo(() => {
        return new Set(TOKEN_SELECTOR_SUPPORTED_NETWORK_IDS)
    }, [])

    // popular chains data from Squid data
    const popularChains = useMemo(() => {
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

    // popular tokens memo, for rendering popular tokens (eg, USDC, USDT and native tokens)
    const popularTokens = useMemo(() => {
        if (!supportedSquidChainsAndTokens || popularChains.length === 0) {
            return []
        }

        const tokens: IUserBalance[] = []
        const popularSymbolsToFind = ['USDC', 'USDT']

        // Note: We use the IUserBalance structure here primarily to reuse the TokenListItem component.
        // for these popular token entries, the amount, price, and value fields are just placeholders and are ignored.
        // the TokenListItem component correctly hides the balance display when `isPopularToken` is true.
        const createPopularTokenEntry = (token: IToken, chainId: string): IUserBalance => ({
            ...token,
            chainId: chainId,
            amount: 0,
            price: 0,
            currency: token.symbol,
            value: '',
        })

        // helper function to sort tokens by priority: USDC first, native second, USDT third
        const sortTokensByPriority = (tokens: IUserBalance[]): IUserBalance[] => {
            return [...tokens].sort((a, b) => {
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

        // if a specific chain is selected, only show popular tokens for that chain
        if (selectedChainID) {
            const chainData = supportedSquidChainsAndTokens[selectedChainID]
            if (!chainData?.tokens) {
                return []
            }

            const chainTokens: IUserBalance[] = []

            // find native token for the selected chain
            const nativeToken = chainData.tokens.find((token) => areEvmAddressesEqual(token.address, SQUID_ETH_ADDRESS))
            if (nativeToken) {
                chainTokens.push(createPopularTokenEntry(nativeToken, selectedChainID))
            }

            // find USDC, USDT for the selected chain
            popularSymbolsToFind.forEach((symbol) => {
                const popularToken = chainData.tokens.find(
                    (token) => token.symbol.toUpperCase() === symbol.toUpperCase()
                )
                if (popularToken && !areEvmAddressesEqual(popularToken.address, SQUID_ETH_ADDRESS)) {
                    chainTokens.push(createPopularTokenEntry(popularToken, selectedChainID))
                }
            })

            return sortTokensByPriority(chainTokens)
        }

        // if no chain is selected, show popular tokens from all popular chains
        popularChains.forEach((chain) => {
            if (!chain?.chainId) return

            const chainData = supportedSquidChainsAndTokens[chain.chainId]
            if (!chainData?.tokens) {
                return
            }

            const nativeToken = chainData.tokens.find((token) => areEvmAddressesEqual(token.address, SQUID_ETH_ADDRESS))
            if (nativeToken) {
                tokens.push(createPopularTokenEntry(nativeToken, chain.chainId))
            } else {
                console.warn(
                    `Native token (${SQUID_ETH_ADDRESS}) not found in Squid data for chainId: ${chain.chainId}`
                )
            }

            popularSymbolsToFind.forEach((symbol) => {
                const popularToken = chainData.tokens.find(
                    (token) => token.symbol.toUpperCase() === symbol.toUpperCase()
                )
                if (popularToken) {
                    if (!areEvmAddressesEqual(popularToken.address, SQUID_ETH_ADDRESS)) {
                        tokens.push(createPopularTokenEntry(popularToken, chain.chainId))
                    }
                }
            })
        })

        // filter out duplicate tokens based on address and chain id
        const uniqueTokens = Array.from(
            new Map(tokens.map((t) => [`${t.address.toLowerCase()}-${t.chainId}`, t])).values()
        )

        return sortTokensByPriority(uniqueTokens)
    }, [popularChains, supportedSquidChainsAndTokens, selectedChainID])

    // filtered popular tokens based on search value
    const filteredPopularTokens = useMemo(() => {
        if (!searchValue) return popularTokens

        const lowerSearchValue = searchValue.toLowerCase()
        return popularTokens.filter((token) => {
            const hasSymbol = !!token.symbol
            const symbolMatch = hasSymbol && token.symbol.toLowerCase().includes(lowerSearchValue)
            const nameMatch = token.name?.toLowerCase().includes(lowerSearchValue) ?? false
            const addressMatch = token.address?.toLowerCase().includes(lowerSearchValue) ?? false

            return hasSymbol && (symbolMatch || nameMatch || addressMatch)
        })
    }, [popularTokens, searchValue])

    const renderTokenListContent = () => {
        if (isLoadingExternalBalances) {
            return <div className="py-4 text-center text-sm text-gray-500">Loading balances...</div>
        }

        if (!isExternalWalletConnected) {
            return (
                <EmptyState
                    title="Connect your wallet"
                    icon="txn-off"
                    cta={
                        <Button
                            variant="transparent"
                            className="h-6 text-xs font-normal text-grey-1 underline"
                            onClick={() => openAppkitModal()}
                        >
                            Connect wallet to see available tokens
                        </Button>
                    }
                />
            )
        }

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
                                if (externalWalletAddress) {
                                    await disconnectWallet()
                                }
                                await openAppkitModal()
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

        if (searchValue && displayTokens.length === 0) {
            return (
                <EmptyState
                    title="No matching tokens found."
                    icon="search"
                    description="Try searching for a different token."
                />
            )
        }

        if (displayTokens.length > 0) {
            return displayTokens.map((balance) => {
                const isSelected =
                    areEvmAddressesEqual(selectedTokenAddress, balance.address) &&
                    selectedChainID === String(balance.chainId)
                return (
                    <TokenListItem
                        key={`${balance.address}_${String(balance.chainId)}_balance`}
                        balance={balance}
                        onClick={() => handleTokenSelect(balance)}
                        isSelected={isSelected}
                    />
                )
            })
        }

        return (
            <EmptyState
                title="You have no token balances."
                icon="txn-off"
                cta={
                    <Button
                        variant="transparent"
                        className="h-6 text-xs font-normal text-grey-1 underline"
                        onClick={() => {
                            disconnectWallet()
                            openAppkitModal()
                        }}
                    >
                        Try connecting to a different wallet.
                    </Button>
                }
            />
        )
    }

    const currentExpandedHeight = drawerHeightVh ?? 80
    const currentHalfHeight = Math.min(60, drawerHeightVh ?? 60)

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
            >
                <div className="flex flex-grow items-center justify-between gap-3 overflow-hidden">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className="relative flex-shrink-0">
                            {buttonLogoURI ? (
                                <Image
                                    src={buttonLogoURI}
                                    alt={`${buttonSymbol} logo`}
                                    width={24}
                                    height={24}
                                    className="rounded-full"
                                />
                            ) : (
                                <Icon name="currency" size={24} />
                            )}
                        </div>
                        <div className="flex flex-col items-start overflow-hidden">
                            <span className="truncate text-base font-semibold text-black">
                                {buttonSymbol || 'Select Token'}
                                {buttonChainName && (
                                    <span className="ml-1 text-sm font-medium text-grey-1">
                                        on <span className="capitalize">{buttonChainName}</span>
                                    </span>
                                )}
                            </span>
                            {buttonFormattedBalance && viewType === 'other' && (
                                <span className="truncate text-xs font-normal text-grey-1">
                                    Balance: {buttonFormattedBalance} {buttonSymbol}
                                </span>
                            )}
                            {viewType === 'withdraw' &&
                                selectedTokenAddress?.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase() && (
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
                            onSelectChain={handleChainSelect}
                            onBack={() => setShowNetworkList(false)}
                            searchValue={networkSearchValue}
                            setSearchValue={setNetworkSearchValue}
                            selectedChainID={selectedChainID}
                            allowedChainIds={allowedChainIds}
                            comingSoonNetworks={TOKEN_SELECTOR_COMING_SOON_NETWORKS}
                        />
                    ) : (
                        <div className="relative flex flex-col space-y-4">
                            {/* Default transaction token section  */}

                            <Section title="Free transaction token!">
                                <Card
                                    className={twMerge(
                                        'shadow-4 cursor-pointer border border-black p-3',
                                        selectedTokenAddress?.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase() &&
                                            selectedChainID === PEANUT_WALLET_CHAIN.id.toString()
                                            ? 'bg-primary-3'
                                            : 'bg-white',
                                        classNameButton
                                    )}
                                    onClick={handleDefaultTokenSelect}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="relative h-8 w-8">
                                                <Image
                                                    src={peanutWalletTokenDetails?.logoURI ?? ''}
                                                    alt={`${peanutWalletTokenDetails?.symbol} logo`}
                                                    width={28}
                                                    height={28}
                                                    className="rounded-full"
                                                />
                                                <Image
                                                    src={peanutWalletTokenDetails?.chainLogoURI ?? ''}
                                                    alt={`${peanutWalletTokenDetails?.chainName}`}
                                                    width={24}
                                                    height={24}
                                                    className="absolute -right-1 bottom-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-gray-700 text-xs text-white"
                                                />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-black">USDC on Arbitrum</p>
                                                <p className="text-sm text-gray-600">No gas fees with this token.</p>
                                            </div>
                                        </div>
                                        <Icon name="chevron-up" size={32} className="h-8 w-8 rotate-90 text-black" />
                                    </div>
                                </Card>
                            </Section>

                            <Divider className="p-0" />

                            {/* Popular chains section - rendered for all views except withdraw view */}
                            {viewType === 'other' ||
                                (viewType === 'claim' && (
                                    <>
                                        <Section title="Select a network">
                                            <div className="flex flex-col gap-4">
                                                <div className="flex items-stretch justify-between space-x-2">
                                                    {popularChains.map((chain) => (
                                                        <NetworkButton
                                                            key={chain.chainId}
                                                            chainName={chain.name}
                                                            chainIconURI={chain.iconURI}
                                                            onClick={() => setSelectedChainID(chain.chainId)}
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
                                ))}

                            <div className="sticky -top-1 z-10 bg-background py-3">
                                <SearchInput
                                    value={searchValue}
                                    onChange={setSearchValue}
                                    onClear={() => setSearchValue('')}
                                    placeholder="Search for a token"
                                />
                            </div>

                            {/* Popular tokens section - only rendered for withdraw view */}
                            {(viewType === 'withdraw' || viewType === 'claim') && !!popularTokens && (
                                <Section
                                    title={`Popular tokens ${selectedChainID ? `on ${selectedNetworkName}` : ''}`}
                                    icon="star"
                                    titleClassName="text-grey-1 font-medium"
                                    className="space-y-4"
                                >
                                    <ScrollableList>
                                        {filteredPopularTokens.length > 0 ? (
                                            filteredPopularTokens.map((token) => {
                                                const balance = token as IUserBalance
                                                const isSelected =
                                                    selectedTokenAddress?.toLowerCase() ===
                                                        balance.address.toLowerCase() &&
                                                    selectedChainID === String(balance.chainId)

                                                return (
                                                    <TokenListItem
                                                        key={`${balance.address}_${String(balance.chainId)}_popular`}
                                                        balance={balance}
                                                        onClick={() => handleTokenSelect(balance)}
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

                            {/* USER's wallet tokens section - rendered for all views except withdraw view */}
                            {(viewType === 'other' || viewType === 'claim') && (
                                <Section
                                    title={`Your tokens ${selectedNetworkName ? `on ${selectedNetworkName}` : ''}`}
                                    className="relative space-y-4"
                                    icon={searchValue ? 'search' : 'wallet-outline'}
                                    titleClassName="text-grey-1 font-medium"
                                >
                                    {selectedNetworkName && (
                                        <div className="absolute -top-4 right-0">
                                            <Button
                                                variant="transparent"
                                                className="h-fit w-fit p-0"
                                                onClick={() => setSelectedChainID('')}
                                            >
                                                <div className="flex size-6 items-center justify-center">
                                                    <Icon name="cancel" className="h-4 w-4" />
                                                </div>
                                            </Button>
                                        </div>
                                    )}

                                    <ScrollableList>{renderTokenListContent()}</ScrollableList>
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
