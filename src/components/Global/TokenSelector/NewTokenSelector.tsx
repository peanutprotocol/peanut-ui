'use client'

import Image from 'next/image'
import React, { ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { Button } from '@/components/0_Bruddle'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import Divider from '@/components/0_Bruddle/Divider'
import BottomDrawer from '@/components/Global/BottomDrawer'
import Card from '@/components/Global/Card'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants/zerodev.consts'
import { tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { IUserBalance } from '@/interfaces'
import { fetchWalletBalances, formatAmount } from '@/utils'
import { useAppKit, useAppKitAccount, useDisconnect } from '@reown/appkit/react'
import EmptyState from '../EmptyStates/EmptyState'
import { Icon } from '../Icons/Icon'
import NetworkButton from './NetworkButton'
import NetworkListView from './NetworkListView'
import TokenListItem from './TokenListItem'
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

const NewTokenSelector: React.FC<NewTokenSelectorProps> = ({ classNameButton, viewType = 'other' }) => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [searchValue, setSearchValue] = useState('')
    const [showNetworkList, setShowNetworkList] = useState(false)
    const [networkSearchValue, setNetworkSearchValue] = useState('')
    const { open: openAppkitModal } = useAppKit()
    const { disconnect: disconnectWallet } = useDisconnect()
    const { isConnected: isExternalWalletConnected, address: externalWalletAddress } = useAppKitAccount()

    const { selectedWallet, isConnected } = useWallet()
    const {
        supportedSquidChainsAndTokens,
        setSelectedTokenAddress,
        setSelectedChainID,
        selectedTokenAddress,
        selectedChainID,
    } = useContext(tokenSelectorContext)

    const [externalBalances, setExternalBalances] = useState<IUserBalance[] | null>(null)
    const [isLoadingExternalBalances, setIsLoadingExternalBalances] = useState(false)
    const prevIsExternalConnected = useRef(isExternalWalletConnected)

    const openDrawer = useCallback(() => setIsDrawerOpen(true), [])
    const closeDrawer = useCallback(() => {
        setIsDrawerOpen(false)
        setTimeout(() => setSearchValue(''), 200)
    }, [])

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

    const displayTokens = useMemo(() => {
        let sourceBalances: IUserBalance[] | null | undefined = null

        if (isExternalWalletConnected && externalBalances !== null) {
            console.log('Using manually fetched external balances.')
            sourceBalances = externalBalances
        } else if (isConnected && selectedWallet?.balances) {
            console.log("Using balances from useWallet's selectedWallet.")
            sourceBalances = selectedWallet.balances
        } else {
            console.log('No balances available.')
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
            const nameMatch = balance.name && balance.name.toLowerCase().includes(lowerSearchValue)
            const addressMatch = balance.address && balance.address.toLowerCase().includes(lowerSearchValue)
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

    const handleNetworkSelect = useCallback(
        (chain: { chainId: string; name: string; iconURI: string }) => {
            setSelectedChainID(chain.chainId)
            setSelectedTokenAddress('')
        },
        [setSelectedChainID, setSelectedTokenAddress, supportedSquidChainsAndTokens]
    )

    const handleFreeTokenSelect = useCallback(() => {
        setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())

        closeDrawer()
    }, [closeDrawer, setSelectedTokenAddress, setSelectedChainID])

    const handleSearchNetwork = useCallback(() => {
        setShowNetworkList(true)
        setNetworkSearchValue('')
    }, [])

    const handleChainSelect = useCallback(
        (chainId: string) => {
            setSelectedChainID(chainId)
            // set token address to native token chain is selected and token is not selected yet
            setSelectedTokenAddress('0x0000000000000000000000000000000000000000')
            setShowNetworkList(false)
        },
        [setSelectedChainID, setSelectedTokenAddress, supportedSquidChainsAndTokens]
    )

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

    const selectedNetworkName = useMemo(() => {
        if (!selectedChainID) return null
        const network = supportedSquidChainsAndTokens[selectedChainID]
        return network?.axelarChainName || network?.axelarChainName || `Chain ${selectedChainID}`
    }, [selectedChainID, supportedSquidChainsAndTokens])

    let buttonSymbol: string | undefined
    let buttonChainName: string | undefined
    let buttonFormattedBalance: string | null = null
    let buttonLogoURI: string | undefined

    if (selectedTokenAddress && selectedChainID) {
        let tokenDetails: IUserBalance | null = null

        if (
            selectedTokenAddress.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase() &&
            selectedChainID === PEANUT_WALLET_CHAIN.id.toString()
        ) {
            buttonSymbol = PEANUT_WALLET_TOKEN_SYMBOL
            buttonChainName =
                supportedSquidChainsAndTokens[PEANUT_WALLET_CHAIN.id]?.axelarChainName || PEANUT_WALLET_CHAIN.name
            buttonLogoURI = ''
        } else if (selectedWallet?.balances) {
            tokenDetails =
                selectedWallet.balances.find(
                    (b) =>
                        b.address.toLowerCase() === selectedTokenAddress.toLowerCase() &&
                        String(b.chainId) === selectedChainID
                ) || null

            if (tokenDetails) {
                buttonSymbol = tokenDetails.symbol
                buttonChainName =
                    supportedSquidChainsAndTokens[String(tokenDetails.chainId)]?.axelarChainName ||
                    `Chain ${tokenDetails.chainId}`
                buttonLogoURI = tokenDetails.logoURI

                if (
                    tokenDetails.amount &&
                    typeof tokenDetails.amount === 'number' &&
                    tokenDetails.decimals !== undefined &&
                    tokenDetails.amount > 0
                ) {
                    try {
                        const displayDecimals = Math.min(tokenDetails.decimals ?? 6, 6)
                        buttonFormattedBalance = formatAmount(tokenDetails.amount.toFixed(displayDecimals))
                    } catch (error) {
                        console.error('Error formatting button balance:', error)
                    }
                }
            }
        }
    } else {
        console.log('Render: No selected token/chain in context for button display.')
    }

    const popularChainIds = useMemo(
        () =>
            TOKEN_SELECTOR_POPULAR_NETWORK_IDS.map((chain) => ({
                chainId: chain.chainId,
                name: chain.name || supportedSquidChainsAndTokens[chain.chainId]?.axelarChainName,
            })),
        [supportedSquidChainsAndTokens]
    )

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
                {buttonSymbol && buttonChainName ? (
                    <div className="flex flex-grow items-center justify-between space-x-3 overflow-hidden">
                        <div className="flex items-center space-x-2 overflow-hidden">
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
                                    {buttonSymbol}
                                    <span className="ml-1 text-sm font-medium text-grey-1">
                                        on <span className="capitalize">{buttonChainName}</span>
                                    </span>
                                </span>
                                {buttonFormattedBalance && (
                                    <span className="truncate text-xs font-normal text-grey-1">
                                        Balance: {buttonFormattedBalance} {buttonSymbol}
                                    </span>
                                )}
                            </div>
                        </div>
                        <Icon
                            name="chevron-up"
                            className={`h-4 w-4 flex-shrink-0 transition-transform ${
                                !isDrawerOpen ? 'rotate-180' : ''
                            }`}
                        />
                    </div>
                ) : (
                    <>
                        <span>Select Token</span>
                        <Icon
                            name="chevron-up"
                            className={`h-4 w-4 transition-transform ${!isDrawerOpen ? 'rotate-180' : ''}`}
                        />
                    </>
                )}
            </Button>

            <BottomDrawer
                isOpen={isDrawerOpen}
                onClose={closeDrawer}
                initialPosition="expanded"
                handleTitle=""
                expandedHeight={95}
                halfHeight={60}
                collapsedHeight={10}
            >
                <div className="mx-auto md:max-w-2xl">
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
                        <div className="flex flex-col space-y-6 pb-10">
                            {viewType === 'withdraw' && (
                                <>
                                    <Section title="Free transaction token!">
                                        <Card
                                            className={twMerge(
                                                'shadow-4 cursor-pointer border border-black p-3',
                                                selectedTokenAddress?.toLowerCase() ===
                                                    PEANUT_WALLET_TOKEN.toLowerCase() &&
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
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white">
                                                            $
                                                        </div>
                                                        <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-gray-700 text-xs text-white">
                                                            A
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-black">USDC on Arbitrum</p>
                                                        <p className="text-sm text-gray-600">
                                                            No gas fees with this token.
                                                        </p>
                                                    </div>
                                                </div>
                                                <Icon
                                                    name="chevron-up"
                                                    size={32}
                                                    className="h-8 w-8 rotate-90 text-black"
                                                />
                                            </div>
                                        </Card>
                                    </Section>
                                    <Divider className="p-0" />
                                </>
                            )}

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

                            <Section title="Select a token" className="space-y-4">
                                <div className="relative">
                                    <BaseInput
                                        variant="md"
                                        className="h-10 w-full border border-black px-10 text-sm font-normal"
                                        placeholder="Search for a token"
                                        value={searchValue}
                                        onChange={(e) => setSearchValue(e.target.value)}
                                    />
                                    <Icon name="search" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" />
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
                                                        <span className="capitalize">{selectedNetworkName}</span>
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
                                                        key={`${balance.address}_${String(balance.chainId)}`}
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
                            </Section>
                        </div>
                    )}
                </div>
            </BottomDrawer>
        </>
    )
}

export default NewTokenSelector
