'use client'

import Image from 'next/image'
import React, { ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { Button } from '@/components/0_Bruddle'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import Divider from '@/components/0_Bruddle/Divider'
import BottomDrawer from '@/components/Global/BottomDrawer'
import Card, { CardPosition } from '@/components/Global/Card'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants/zerodev.consts'
import { tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { IUserBalance } from '@/interfaces'
import { formatAmount } from '@/utils'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import EmptyState from '../EmptyStates/EmptyState'
import { Icon } from '../Icons/Icon'
import NavHeader from '../NavHeader'

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

interface NetworkButtonProps {
    chainName: string
    chainIconURI?: string
    onClick: () => void
    isSearch?: boolean
    isSelected?: boolean
}

const NetworkButton: React.FC<NetworkButtonProps> = ({
    chainName,
    chainIconURI,
    onClick,
    isSearch = false,
    isSelected = false,
}) => (
    <Button
        className={twMerge(
            'shadow-2 flex h-fit min-w-14 flex-1 flex-col items-center justify-center gap-1 p-3 text-center hover:bg-grey-1/10',
            isSelected ? 'bg-primary-3' : 'bg-white'
        )}
        onClick={onClick}
    >
        <div
            className={twMerge(
                'flex h-6 min-h-6 w-6 items-center justify-center rounded-full',
                isSearch ? 'bg-black p-0.5 text-white' : 'bg-transparent'
            )}
        >
            {isSearch ? (
                <Icon name="cancel" size={12} className="size-4 rotate-45" />
            ) : chainIconURI ? (
                <Image src={chainIconURI} alt={chainName} width={24} height={24} className="h-6 w-6 rounded-full" />
            ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 text-xs">
                    {chainName.substring(0, 3).toUpperCase()}
                </div>
            )}
        </div>
        <span className="text-sm font-medium">
            {isSearch ? 'more' : chainName.length > 6 ? chainName.substring(0, 6) : chainName}
        </span>
    </Button>
)

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
        return supportedSquidChainsAndTokens[String(balance.chainId)]?.axelarChainName || `Chain ${balance.chainId}`
    }, [supportedSquidChainsAndTokens, balance.chainId])

    const formattedBalance = useMemo(() => {
        const hasAmount = balance.amount !== undefined && balance.amount !== null
        const isNumber = typeof balance.amount === 'number'
        const hasDecimals = balance.decimals !== undefined && balance.decimals !== null
        const isPositive = hasAmount && isNumber && balance.amount > 0

        if (hasAmount && isNumber && hasDecimals && isPositive) {
            try {
                const displayDecimals = Math.min(balance.decimals ?? 6, 6)
                const formatted = balance.amount.toFixed(displayDecimals)
                return formatAmount(formatted)
            } catch (error) {
                console.error(`TokenListItem: Error formatting number for ${balance.symbol}:`, error, balance)
                return 'N/A'
            }
        }
        return null
    }, [balance.amount, balance.decimals])

    return (
        <div
            className={twMerge('shadow-4 cursor-pointer rounded-sm', isSelected && 'bg-primary-3', className)}
            onClick={onClick}
        >
            <Card
                position={position}
                className={twMerge('!overflow-visible border-black p-4', isSelected ? 'bg-primary-3' : 'bg-white')}
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

interface NetworkListViewProps {
    chains: Record<string, any>
    onSelectChain: (chainId: string) => void
    onBack: () => void
    searchValue: string
    setSearchValue: (value: string) => void
    selectedChainID: string
}

const NetworkListView: React.FC<NetworkListViewProps> = ({
    chains,
    onSelectChain,
    onBack,
    searchValue,
    setSearchValue,
    selectedChainID,
}) => {
    const filteredChains = useMemo(() => {
        const lowerSearchValue = searchValue.toLowerCase()
        return Object.values(chains).filter(
            (chain) =>
                chain.axelarChainName?.toLowerCase().includes(lowerSearchValue) ||
                chain.chainName?.toLowerCase().includes(lowerSearchValue)
        )
    }, [chains, searchValue])

    return (
        <div className="relative flex flex-col space-y-4">
            <NavHeader title="More networks" onPrev={onBack} />
            <div className="flex flex-col gap-3">
                <div className="relative">
                    <BaseInput
                        variant="md"
                        className="h-10 w-full border border-black px-10 text-sm font-normal"
                        placeholder="Search for a network"
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
                                <Icon name="cancel" />
                            </div>
                        </Button>
                    )}
                </div>
                <div className="flex h-full flex-col gap-2 overflow-y-auto">
                    {filteredChains.length > 0 ? (
                        filteredChains.map((chain) => {
                            const isSelected = chain.chainId === selectedChainID

                            return (
                                <div
                                    key={chain.chainId}
                                    className={twMerge(
                                        'cursor-pointer rounded-sm shadow-sm',
                                        isSelected && 'bg-primary-3'
                                    )}
                                    onClick={() => onSelectChain(chain.chainId)}
                                >
                                    <Card
                                        position="single"
                                        className={twMerge(
                                            '!overflow-visible border-black p-4',
                                            isSelected ? 'bg-primary-3' : 'bg-white'
                                        )}
                                        border={true}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <div className="relative h-8 w-8">
                                                    {chain.chainIconURI ? (
                                                        <Image
                                                            src={chain.chainIconURI}
                                                            alt={`${chain.axelarChainName} logo`}
                                                            width={32}
                                                            height={32}
                                                            className="rounded-full"
                                                        />
                                                    ) : (
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 text-black">
                                                            {chain.axelarChainName?.substring(0, 2) || 'CH'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-base font-semibold capitalize text-black">
                                                        {chain.axelarChainName || chain.chainName}
                                                    </span>
                                                </div>
                                            </div>
                                            <Icon
                                                name="chevron-up"
                                                size={32}
                                                className="h-8 w-8 flex-shrink-0 rotate-90 text-black"
                                            />
                                        </div>
                                    </Card>
                                </div>
                            )
                        })
                    ) : (
                        <div className="py-4 text-center text-sm text-gray-500">
                            No networks found matching "{searchValue}"
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

interface NewTokenSelectorProps {
    classNameButton?: string
    onTokenSelect?: (token: IUserBalance) => void
    onNetworkSelect?: (network: any) => void
}

const NewTokenSelector: React.FC<NewTokenSelectorProps> = ({ classNameButton, onTokenSelect, onNetworkSelect }) => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [searchValue, setSearchValue] = useState('')
    const [showNetworkList, setShowNetworkList] = useState(false)
    const [networkSearchValue, setNetworkSearchValue] = useState('')
    const { open: openAppkitModal } = useAppKit()
    const { isConnected: isExternalWalletConnected } = useAppKitAccount()
    const { selectedWallet, isConnected } = useWallet()
    const {
        supportedSquidChainsAndTokens,
        setSelectedTokenAddress,
        setSelectedChainID,
        selectedTokenAddress,
        selectedChainID,
    } = useContext(tokenSelectorContext)

    const openDrawer = useCallback(() => setIsDrawerOpen(true), [])
    const closeDrawer = useCallback(() => {
        setIsDrawerOpen(false)
        const timer = setTimeout(() => setSearchValue(''), 200)
        return () => clearTimeout(timer)
    }, [])

    const displayTokens = useMemo(() => {
        if (!isConnected) {
            return []
        }
        if (!selectedWallet?.balances) {
            return []
        }

        const lowerSearchValue = searchValue.toLowerCase()

        let filteredByChain = selectedWallet.balances
        if (selectedChainID) {
            filteredByChain = selectedWallet.balances.filter((balance) => {
                const balanceChainId = String(balance.chainId)
                const isMatch = balanceChainId === selectedChainID

                return isMatch
            })
        }

        const filteredBalances = filteredByChain.filter((balance) => {
            const hasSymbol = !!balance.symbol
            const symbolMatch = hasSymbol && balance.symbol.toLowerCase().includes(lowerSearchValue)
            const nameMatch = balance.name && balance.name.toLowerCase().includes(lowerSearchValue)
            const addressMatch = balance.address && balance.address.toLowerCase().includes(lowerSearchValue)

            const shouldInclude = hasSymbol && (symbolMatch || nameMatch || addressMatch)

            return shouldInclude
        })

        return filteredBalances
    }, [isConnected, selectedWallet?.balances, searchValue, selectedChainID])

    const handleTokenSelect = useCallback(
        (balance: IUserBalance) => {
            const addressToSet = balance.address
            const chainIdToSet = String(balance.chainId)

            setSelectedTokenAddress(addressToSet)
            setSelectedChainID(chainIdToSet)

            onTokenSelect?.(balance)
            closeDrawer()
        },
        [onTokenSelect, closeDrawer, setSelectedTokenAddress, setSelectedChainID]
    )

    const handleNetworkSelect = useCallback(
        (chain: { chainId: string; name: string; iconURI: string }) => {
            setSelectedChainID(chain.chainId)
            setSelectedTokenAddress('0x0000000000000000000000000000000000000000')

            if (onNetworkSelect) {
                onNetworkSelect(supportedSquidChainsAndTokens[chain.chainId])
            }
        },
        [setSelectedChainID, setSelectedTokenAddress, onNetworkSelect, supportedSquidChainsAndTokens]
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
            setSelectedTokenAddress('0x0000000000000000000000000000000000000000')
            setShowNetworkList(false)
            const selectedNetwork = Object.values(supportedSquidChainsAndTokens).find(
                (chain) => chain.chainId === chainId
            )
            if (selectedNetwork && onNetworkSelect) {
                onNetworkSelect(selectedNetwork)
            }
        },
        [setSelectedChainID, setSelectedTokenAddress, onNetworkSelect, supportedSquidChainsAndTokens]
    )

    const hasTokensOnSelectedNetwork = useMemo(() => {
        if (!selectedChainID || !selectedWallet?.balances) return true
        return selectedWallet.balances.some((balance) => String(balance.chainId) === selectedChainID)
    }, [selectedChainID, selectedWallet?.balances])

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

    // popular chain mapping - using this mapping to get chains data from Squid data
    const popularChainIds = useMemo(
        () => [
            {
                chainId: '42161',
                name: 'ARB',
            },
            {
                chainId: '1',
                name: 'ETH',
            },
            {
                chainId: '10',
                name: 'OP',
            },
            {
                chainId: '8453',
                name: 'BASE',
            },
        ],
        []
    )

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
                className={twMerge('flex min-h-16 w-full items-center justify-between bg-white p-4', classNameButton)}
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
                {showNetworkList ? (
                    <NetworkListView
                        chains={supportedSquidChainsAndTokens}
                        onSelectChain={handleChainSelect}
                        onBack={() => setShowNetworkList(false)}
                        searchValue={networkSearchValue}
                        setSearchValue={setNetworkSearchValue}
                        selectedChainID={selectedChainID}
                    />
                ) : (
                    <div className="flex flex-col space-y-6 pb-10">
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
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white">
                                                $
                                            </div>
                                            <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-gray-700 text-xs text-white">
                                                A
                                            </div>
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

                        <Section title="Select a network">
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
                                <NetworkButton chainName="Search" isSearch={true} onClick={handleSearchNetwork} />
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
                                            <Icon name="wallet" size={16} />
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
                                                            <span className="capitalize">{selectedNetworkName}</span>
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
                                    {displayTokens && !!displayTokens.length ? (
                                        displayTokens.map((balance) => {
                                            const isSelected =
                                                selectedTokenAddress?.toLowerCase() === balance.address.toLowerCase() &&
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
                                        <div className="text-center">
                                            {!selectedWallet?.balances || selectedWallet.balances.length === 0 ? (
                                                <EmptyState
                                                    title="You have no token balances."
                                                    icon="txn-off"
                                                    cta={
                                                        !isExternalWalletConnected ? (
                                                            <Button
                                                                variant="transparent"
                                                                className="h-6 text-xs font-normal text-grey-1 underline"
                                                                onClick={() => openAppkitModal()}
                                                            >
                                                                Connect your wallet to see available tokens
                                                            </Button>
                                                        ) : null
                                                    }
                                                />
                                            ) : selectedChainID && !hasTokensOnSelectedNetwork ? (
                                                <>
                                                    <EmptyState
                                                        title={
                                                            <span>
                                                                You don't have any tokens on{' '}
                                                                <span className="capitalize">
                                                                    {selectedNetworkName}
                                                                </span>
                                                            </span>
                                                        }
                                                        icon="txn-off"
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
                                                </>
                                            ) : searchValue ? (
                                                'No matching tokens found.'
                                            ) : (
                                                'No tokens to display.'
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Section>
                    </div>
                )}
            </BottomDrawer>
        </>
    )
}

export default NewTokenSelector
