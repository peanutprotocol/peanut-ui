'use client'

import Image from 'next/image'
import React, { ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { Button } from '@/components/0_Bruddle'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import Divider from '@/components/0_Bruddle/Divider'
import BottomDrawer from '@/components/Global/BottomDrawer'
import Card from '@/components/Global/Card'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { IToken, IUserBalance } from '@/interfaces'
import { fetchWalletBalances, formatAmount } from '@/utils'
import { useAppKit, useAppKitAccount, useDisconnect } from '@reown/appkit/react'
import EmptyState from '../EmptyStates/EmptyState'
import { Icon } from '../Icons/Icon'
import NetworkButton from './Components/NetworkButton'
import NetworkListView from './Components/NetworkListView'
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
}

const Section: React.FC<SectionProps> = ({ title, children, className }) => (
    <div className={twMerge('space-y-2', className)}>
        <h2 className="text-md font-bold text-black">{title}</h2>
        {children}
    </div>
)

interface NewTokenSelectorProps {
    classNameButton?: string
    viewType?: 'withdraw' | 'other'
}

const TokenSelector: React.FC<NewTokenSelectorProps> = ({ classNameButton, viewType = 'other' }) => {
    // state to track content height
    const [contentHeight, setContentHeight] = useState(0)
    const contentRef = useRef<HTMLDivElement>(null)
    // local states for the component
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
    const prevIsExternalConnected = useRef(isExternalWalletConnected)
    // usewallet and token selector context
    const { selectedWallet, isConnected } = useWallet()
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
        if (isExternalWalletConnected && !prevIsExternalConnected.current && externalWalletAddress) {
            setIsLoadingExternalBalances(true)
            setExternalBalances(null)

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
        } else if (!isExternalWalletConnected && prevIsExternalConnected.current) {
            setExternalBalances(null)
        }

        prevIsExternalConnected.current = isExternalWalletConnected
    }, [isExternalWalletConnected, externalWalletAddress])

    // display tokens memo, for rendering tokens and balances from users wallet
    const displayTokens = useMemo(() => {
        let sourceBalances: IUserBalance[] | null | undefined = null

        if (isExternalWalletConnected && externalBalances !== null) {
            sourceBalances = externalBalances
        } else if (isConnected && selectedWallet?.balances) {
            sourceBalances = selectedWallet.balances
        } else {
            sourceBalances = []
        }

        if (!sourceBalances) {
            return []
        }

        const lowerSearchValue = searchValue.toLowerCase()

        let filteredByChain = sourceBalances
        if (selectedChainID) {
            filteredByChain = sourceBalances.filter((balance) => {
                const balanceChainId = String(balance.chainId)
                return balanceChainId === selectedChainID
            })
        }

        const filteredBalances = filteredByChain.filter((balance) => {
            const hasSymbol = !!balance.symbol
            const symbolMatch = hasSymbol && balance.symbol.toLowerCase().includes(lowerSearchValue)
            const nameMatch = balance.name?.toLowerCase().includes(lowerSearchValue) ?? false
            const addressMatch = balance.address?.toLowerCase().includes(lowerSearchValue) ?? false
            return hasSymbol && (symbolMatch || nameMatch || addressMatch)
        })

        return filteredBalances
    }, [
        isConnected,
        selectedWallet?.balances,
        searchValue,
        selectedChainID,
        isExternalWalletConnected,
        externalBalances,
    ])

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

    // handles network selection based on chain id
    const handleNetworkSelect = useCallback(
        (chain: { chainId: string; name: string; iconURI: string }) => {
            setSelectedChainID(chain.chainId)
            setSelectedTokenAddress('')
        },
        [setSelectedChainID, setSelectedTokenAddress, supportedSquidChainsAndTokens]
    )

    // handles free USDC on arb token selection
    const handleFreeTokenSelect = useCallback(() => {
        setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())

        closeDrawer()
    }, [closeDrawer, setSelectedTokenAddress, setSelectedChainID])

    // renders network list
    const handleSearchNetwork = useCallback(() => {
        setShowNetworkList(true)
        setNetworkSearchValue('')
    }, [])

    // handles chain selection based on chain id
    const handleChainSelect = useCallback(
        (chainId: string) => {
            setSelectedChainID(chainId)
            // set token address to native token chain is selected and token is not selected yet
            setSelectedTokenAddress('0x0000000000000000000000000000000000000000')
            setShowNetworkList(false)
        },
        [setSelectedChainID, setSelectedTokenAddress, supportedSquidChainsAndTokens]
    )

    // checks if there are tokens on the selected network
    const hasTokensOnSelectedNetwork = useMemo(() => {
        if (!selectedChainID) return false

        let sourceBalances: IUserBalance[] | null | undefined = null
        if (isExternalWalletConnected && externalBalances !== null) {
            sourceBalances = externalBalances
        } else if (isConnected && selectedWallet?.balances) {
            sourceBalances = selectedWallet.balances
        }

        if (!sourceBalances || sourceBalances.length === 0) return false
        return sourceBalances.some((balance) => String(balance.chainId) === selectedChainID)
    }, [selectedChainID, selectedWallet?.balances, isConnected, isExternalWalletConnected, externalBalances])

    // selected network name memo, being used ui
    const selectedNetworkName = useMemo(() => {
        if (!selectedChainID) return null
        const network = supportedSquidChainsAndTokens[selectedChainID]
        return network?.axelarChainName || network?.axelarChainName || `Chain ${selectedChainID}`
    }, [selectedChainID, supportedSquidChainsAndTokens])

    const peanutWalletTokenDetails = useMemo(() => {
        if (!supportedSquidChainsAndTokens) return null

        const chainInfo = supportedSquidChainsAndTokens[PEANUT_WALLET_CHAIN.id]
        if (!chainInfo) return null

        const token = chainInfo.tokens.find((t) => t.address.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase())
        if (!token) return null

        // check if we have a balance for this token
        let balance: string | null = null

        // first check external wallet balances
        if (isExternalWalletConnected && externalBalances) {
            const externalTokenBalance = externalBalances.find(
                (b) =>
                    b.address.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase() &&
                    String(b.chainId) === PEANUT_WALLET_CHAIN.id.toString()
            )

            if (externalTokenBalance) {
                balance = formatAmount(
                    externalTokenBalance.amount.toFixed(Math.min(externalTokenBalance.decimals ?? 6, 6))
                )
            }
        }

        // if not found in external wallet, check connected wallet
        if (!balance && isConnected && selectedWallet?.balances) {
            const walletTokenBalance = selectedWallet.balances.find(
                (b) =>
                    b.address.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase() &&
                    String(b.chainId) === PEANUT_WALLET_CHAIN.id.toString()
            )

            if (walletTokenBalance) {
                balance = formatAmount(walletTokenBalance.amount.toFixed(Math.min(walletTokenBalance.decimals ?? 6, 6)))
            }
        }

        return {
            symbol: token.symbol,
            chainName: chainInfo.axelarChainName,
            logoURI: token.logoURI,
            chainLogoURI: chainInfo.chainIconURI,
            balance: balance,
        }
    }, [
        supportedSquidChainsAndTokens,
        isExternalWalletConnected,
        externalBalances,
        isConnected,
        selectedWallet?.balances,
    ])

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
        // check if we're using the peanut wallet token
        if (
            selectedTokenAddress.toLowerCase() !== PEANUT_WALLET_TOKEN.toLowerCase() ||
            selectedChainID !== PEANUT_WALLET_CHAIN.id.toString()
        ) {
            // get the appropriate balance source
            const sourceBalances =
                isExternalWalletConnected && externalBalances !== null
                    ? externalBalances
                    : isConnected && selectedWallet?.balances
                      ? selectedWallet.balances
                      : null

            // try to find user's balance for this token
            const userBalanceDetails =
                sourceBalances?.find(
                    (b) =>
                        b.address.toLowerCase() === selectedTokenAddress.toLowerCase() &&
                        String(b.chainId) === selectedChainID
                ) || null

            // get chain info for display
            const chainInfo = supportedSquidChainsAndTokens[selectedChainID]

            if (userBalanceDetails) {
                // use user's balance details if available
                buttonSymbol = userBalanceDetails.symbol
                buttonChainName = chainInfo?.axelarChainName || `Chain ${selectedChainID}`
                buttonLogoURI = userBalanceDetails.logoURI
                buttonFormattedBalance = formatAmount(
                    userBalanceDetails.amount.toFixed(Math.min(userBalanceDetails.decimals ?? 6, 6))
                )
            } else if (chainInfo?.tokens) {
                // if no balance found, try to get token details from chain info
                const generalTokenDetails = chainInfo.tokens.find(
                    (t) => t.address.toLowerCase() === selectedTokenAddress.toLowerCase()
                )

                if (generalTokenDetails) {
                    buttonSymbol = generalTokenDetails.symbol
                    buttonChainName = chainInfo.axelarChainName || `Chain ${selectedChainID}`
                    buttonLogoURI = generalTokenDetails.logoURI
                    // Don't show balance for tokens without balance data
                    buttonFormattedBalance = null
                }
            }
        }
    }

    // popular chains data from Squid data, using the popular chain ids mapping
    const popularChainIds = useMemo(
        () =>
            TOKEN_SELECTOR_POPULAR_NETWORK_IDS.map((chain) => ({
                chainId: chain.chainId,
                name: chain.name || supportedSquidChainsAndTokens[chain.chainId]?.axelarChainName,
            })),
        [supportedSquidChainsAndTokens]
    )

    // allowed chain ids memo, using the supported network ids mapping
    const allowedChainIds = useMemo(() => {
        return new Set(TOKEN_SELECTOR_SUPPORTED_NETWORK_IDS)
    }, [])

    // popular chains data from Squid data
    const popularChains = useMemo(() => {
        if (!supportedSquidChainsAndTokens) return []

        return popularChainIds
            .map((popularChain) => {
                const chain = supportedSquidChainsAndTokens[popularChain.chainId]
                if (!chain) return null

                return {
                    chainId: chain.chainId,
                    name: popularChain.name || chain.axelarChainName,
                    iconURI: chain.chainIconURI || '',
                }
            })
            .filter(Boolean) // remove null entries if any chain not found
    }, [supportedSquidChainsAndTokens, popularChainIds])

    // popular tokens memo, for rendering popular tokens (eg, USDC, USDT and native tokens)
    const popularTokens = useMemo(() => {
        if (!supportedSquidChainsAndTokens || popularChains.length === 0) {
            return []
        }

        const tokens: IUserBalance[] = []
        const popularSymbolsToFind = ['USDC', 'USDT']
        const nativeTokenAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' // note: native token address in squid data is 0xe.. and not 0x00..

        // creates a placeholder balance popular tokens, note we dont show the balance amount for these tokens
        const createPlaceholderBalance = (token: IToken, chainId: string): IUserBalance => ({
            ...token,
            chainId: chainId,
            amount: 0,
            price: 0,
            currency: token.symbol,
            value: '',
        })

        // find native token for each popular chain and save them in tokens array
        popularChains.forEach((chain) => {
            if (!chain?.chainId) return

            const chainData = supportedSquidChainsAndTokens[chain.chainId]
            if (!chainData?.tokens) {
                return
            }

            const nativeToken = chainData.tokens.find((token) => token.address.toLowerCase() === nativeTokenAddress)
            if (nativeToken) {
                tokens.push(createPlaceholderBalance(nativeToken, chain.chainId))
            } else {
                console.warn(
                    `Native token (${nativeTokenAddress}) not found in Squid data for chainId: ${chain.chainId}`
                )
            }

            popularSymbolsToFind.forEach((symbol) => {
                const popularToken = chainData.tokens.find(
                    (token) => token.symbol.toUpperCase() === symbol.toUpperCase()
                )
                if (popularToken) {
                    if (popularToken.address.toLowerCase() !== nativeTokenAddress) {
                        tokens.push(createPlaceholderBalance(popularToken, chain.chainId))
                    }
                }
            })
        })

        // filter out duplicate tokens based on address and chain id
        const uniqueTokens = Array.from(new Map(tokens.map((t) => [`${t.address}-${t.chainId}`, t])).values())

        // sort popular tokens in order of USDC, native tokens, and USDT
        uniqueTokens.sort((a, b) => {
            const isANative = a.address.toLowerCase() === nativeTokenAddress
            const isBNative = b.address.toLowerCase() === nativeTokenAddress
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

        return uniqueTokens
    }, [popularChains, supportedSquidChainsAndTokens])

    // calculate content height for drawers dynamic height
    useEffect(() => {
        if (contentRef.current) {
            const observer = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    // Get the height as a percentage of viewport height
                    const heightVh = Math.min(90, (entry.contentRect.height / window.innerHeight) * 100 + 5)
                    setContentHeight(heightVh)
                }
            })

            observer.observe(contentRef.current)
            return () => observer.disconnect()
        }
    }, [])

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
                handleTitle=""
                expandedHeight={contentHeight || 80}
                halfHeight={Math.min(60, contentHeight || 60)}
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
                        <div className="flex flex-col space-y-6">
                            {/* Free transaction token section  */}

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
                                    onClick={handleFreeTokenSelect}
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
                            {viewType === 'other' && (
                                <>
                                    <Section title="Select a network">
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-stretch justify-between space-x-2">
                                                {popularChains.map((chain) => (
                                                    <NetworkButton
                                                        key={chain?.chainId}
                                                        chainName={chain?.name ?? ''}
                                                        chainIconURI={chain?.iconURI ?? ''}
                                                        onClick={() => chain && handleNetworkSelect(chain)}
                                                        isSelected={chain?.chainId === selectedChainID}
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
                            )}

                            {/* Popular tokens section - only rendered for withdraw view */}
                            {viewType === 'withdraw' && !!popularTokens.length && (
                                <Section title="Popular tokens" className="space-y-4">
                                    <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto pb-2 pr-1">
                                        {popularTokens.map((token) => {
                                            const balance = token as IUserBalance
                                            const isSelected =
                                                selectedTokenAddress?.toLowerCase() === balance.address.toLowerCase() &&
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
                                        })}
                                    </div>
                                </Section>
                            )}

                            {/* USER's wallet tokens section - rendered for all views except withdraw view */}
                            {viewType === 'other' && (
                                <Section title="Select a token" className="space-y-4">
                                    {/* Search input for finding tokens */}
                                    <div className="relative">
                                        <BaseInput
                                            variant="md"
                                            className="h-10 w-full border border-black px-10 text-sm font-normal"
                                            placeholder="Search for a token"
                                            value={searchValue}
                                            onChange={(e) => setSearchValue(e.target.value)}
                                        />
                                        <Icon
                                            name="search"
                                            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2"
                                        />
                                        {searchValue && (
                                            <Button
                                                variant="transparent"
                                                onClick={() => setSearchValue('')}
                                                className="absolute right-2 top-1/2 w-fit -translate-y-1/2 p-0"
                                            >
                                                <div className="flex size-6 items-center justify-center">
                                                    <Icon name="cancel" className="h-5 w-5" />
                                                </div>
                                            </Button>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {/* Section title - based on search value or selected network name */}
                                        <div className="flex items-center justify-between gap-2 text-sm text-grey-1">
                                            <div className="flex items-center gap-2">
                                                {searchValue ? (
                                                    <Icon name="search" size={16} />
                                                ) : (
                                                    <Icon name="wallet-outline" size={16} />
                                                )}
                                                <div>
                                                    {searchValue ? (
                                                        'Search Results'
                                                    ) : (
                                                        <div>
                                                            Your Tokens{' '}
                                                            {selectedNetworkName && (
                                                                <span>
                                                                    <span>on </span>
                                                                    <span className="capitalize">
                                                                        {selectedNetworkName}
                                                                    </span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {selectedNetworkName && (
                                                <Button
                                                    variant="transparent"
                                                    className="h-fit w-fit p-0"
                                                    onClick={() => setSelectedChainID('')}
                                                >
                                                    <div className="flex size-6 items-center justify-center">
                                                        <Icon name="cancel" className="h-4 w-4" />
                                                    </div>
                                                </Button>
                                            )}
                                        </div>

                                        {/* Token list section with scrollable container */}
                                        <div className="max-h-[50vh] overflow-y-auto pb-2 pr-1">
                                            <div className="flex flex-col gap-3">
                                                {isLoadingExternalBalances ? (
                                                    <div className="py-4 text-center text-sm text-gray-500">
                                                        Loading balances...
                                                    </div>
                                                ) : !isExternalWalletConnected ? (
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
                                                ) : externalBalances && externalBalances.length === 0 ? (
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
                                                ) : selectedChainID && !hasTokensOnSelectedNetwork ? (
                                                    <EmptyState
                                                        title={
                                                            <span>
                                                                You don't have any tokens on{' '}
                                                                <span className="capitalize">
                                                                    {selectedNetworkName}
                                                                </span>
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
                                                ) : searchValue && displayTokens.length === 0 ? (
                                                    <EmptyState
                                                        title="No matching tokens found."
                                                        icon="search"
                                                        description="Try searching for a different token."
                                                    />
                                                ) : displayTokens && displayTokens.length > 0 ? (
                                                    displayTokens.map((balance) => {
                                                        const isSelected =
                                                            selectedTokenAddress?.toLowerCase() ===
                                                                balance.address.toLowerCase() &&
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
                                                ) : (
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
                                                )}
                                            </div>
                                        </div>
                                    </div>
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
