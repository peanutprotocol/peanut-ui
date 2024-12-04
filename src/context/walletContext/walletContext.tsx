'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react'
import * as interfaces from '@/interfaces'
import { useAccount } from 'wagmi'
import { useZeroDev } from './zeroDevContext.context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import { Chain, erc20Abi, getAddress, parseUnits } from 'viem'
import { useAuth } from '../authContext'
import {
    backgroundColorFromAddress,
    areEvmAddressesEqual,
    fetchWalletBalances,
    getUserPreferences,
    updateUserPreferences,
} from '@/utils'
import { peanutPublicClient } from '@/constants/viem.consts'

interface WalletContextType {
    selectedWallet: interfaces.IWallet | undefined
    setSelectedWallet: (wallet: interfaces.IWallet) => void
    wallets: interfaces.IWallet[]
    address?: string
    chain: Chain
    isConnected: boolean
    signInModal: {
        visible: boolean
        open: () => void
        close: () => void
    }
    walletColor: string
    refetchBalances: (address: string) => Promise<void>
    isPeanutWallet: boolean
    isExternalWallet: boolean
}

function isPeanut(wallet: interfaces.IDBWallet | undefined) {
    return wallet?.walletProviderType === interfaces.WalletProviderType.PEANUT
}

function isExternalWallet(wallet: interfaces.IDBWallet | undefined) {
    return wallet?.walletProviderType === interfaces.WalletProviderType.BYOW
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export const WalletProvider = ({ children }: { children: ReactNode }) => {
    const queryClient = useQueryClient()
    const [promptWalletSigninOpen, setPromptWalletSigninOpen] = useState(false)
    ////// ZeroDev props
    const { address: kernelClientAddress, isKernelClientReady } = useZeroDev()

    ////// BYOW props
    const { address: wagmiAddress, isConnected: isWagmiConnected } = useAccount()

    ////// User props
    const { addAccount, user } = useAuth()

    const [selectedAddress, setSelectedAddress] = useState<string | undefined>(
        getUserPreferences()?.lastSelectedWallet?.address
    )

    const isWalletConnected = useCallback(
        (wallet: interfaces.IDBWallet): boolean => {
            if (isPeanut(wallet) && kernelClientAddress) {
                return isKernelClientReady && areEvmAddressesEqual(kernelClientAddress, wallet.address)
            } else if (wagmiAddress) {
                return isWagmiConnected && areEvmAddressesEqual(wagmiAddress, wallet.address)
            }
            return false
        },
        [isKernelClientReady, kernelClientAddress, isWagmiConnected, wagmiAddress]
    )

    const createDefaultDBWallet = (address: string): interfaces.IDBWallet => ({
        walletProviderType: interfaces.WalletProviderType.BYOW,
        protocolType: interfaces.WalletProtocolType.EVM,
        address,
    })

    const { data: wallets = [] } = useQuery<interfaces.IWallet[]>({
        queryKey: ['wallets', user?.accounts, wagmiAddress],
        queryFn: async () => {
            // non users can connect BYOW (to pay a request for example)
            if (!user) {
                if (!wagmiAddress) return []

                const { balances, totalBalance } = await fetchWalletBalances(wagmiAddress)
                return [
                    {
                        ...createDefaultDBWallet(wagmiAddress),
                        connected: isWalletConnected(createDefaultDBWallet(wagmiAddress)),
                        balances,
                        balance: parseUnits(totalBalance.toString(), 6),
                    },
                ]
            }

            const processedWallets = user.accounts
                .filter((account) =>
                    Object.values(interfaces.WalletProviderType).includes(
                        account.account_type as unknown as interfaces.WalletProviderType
                    )
                )
                .map(async (account) => {
                    const dbWallet: interfaces.IDBWallet = {
                        walletProviderType: account.account_type as unknown as interfaces.WalletProviderType,
                        protocolType: interfaces.WalletProtocolType.EVM,
                        address: account.account_identifier,
                    }

                    let balance = BigInt(0)
                    let balances: interfaces.IUserBalance[] | undefined

                    if (isPeanut(dbWallet)) {
                        balance = await peanutPublicClient.readContract({
                            address: PEANUT_WALLET_TOKEN,
                            abi: erc20Abi,
                            functionName: 'balanceOf',
                            args: [getAddress(dbWallet.address)],
                        })
                    } else {
                        // For BYOW wallets, fetch all balances
                        const { balances: fetchedBalances, totalBalance } = await fetchWalletBalances(dbWallet.address)
                        balances = fetchedBalances
                        balance = parseUnits(totalBalance.toString(), 6)
                    }

                    const wallet: interfaces.IWallet = {
                        ...dbWallet,
                        balance,
                        balances,
                        connected: false, // Will be set in processedWallets memo
                    }

                    return wallet
                })
            return Promise.all(processedWallets)
        },
    })

    const selectedWallet = useMemo(() => {
        if (!selectedAddress || !wallets.length) return undefined
        const wallet = wallets.find((w) => w.address === selectedAddress)
        if (!wallet) return undefined

        return {
            ...wallet,
            connected: isWalletConnected(wallet),
        }
    }, [selectedAddress, wallets, isWalletConnected])

    // Set initial selected address
    useEffect(() => {
        if (!selectedAddress && wallets.length > 0) {
            const initialWallet = wallets.find(isPeanut) ?? wallets[0]
            setSelectedAddress(initialWallet.address)
        }
    }, [wallets, selectedAddress])

    // Remember selected address
    useEffect(() => {
        if (selectedAddress) {
            updateUserPreferences({
                lastSelectedWallet: { address: selectedAddress },
            })
        }
    }, [selectedAddress])

    // Add new BYOW wallet when connected
    useEffect(() => {
        if (!user || !wagmiAddress || !wallets.length) return

        const walletExists = wallets.some((wallet) => areEvmAddressesEqual(wallet.address, wagmiAddress))
        if (!walletExists) {
            addAccount({
                accountIdentifier: wagmiAddress,
                accountType: interfaces.WalletProviderType.BYOW,
                userId: user.user.userId as string,
            }).catch(console.error)
        }
    }, [wagmiAddress, wallets, user])

    const processedWallets = useMemo(
        () =>
            wallets.map((wallet) => ({
                ...wallet,
                connected: isWalletConnected(wallet),
            })),
        [wallets, isWalletConnected]
    )

    const refetchBalances = useCallback(
        async (address: string) => {
            const wallet = wallets.find((w) => w.address === address)
            if (!wallet) return

            try {
                if (isPeanut(wallet)) {
                    const balance = await peanutPublicClient.readContract({
                        address: PEANUT_WALLET_TOKEN,
                        abi: erc20Abi,
                        functionName: 'balanceOf',
                        args: [getAddress(address)],
                    })

                    await queryClient.setQueryData(
                        ['wallets', user?.accounts, wagmiAddress],
                        (oldData: interfaces.IWallet[] | undefined) =>
                            oldData?.map((w) => (w.address === address ? { ...w, balance } : w))
                    )
                } else {
                    const { balances, totalBalance } = await fetchWalletBalances(address)

                    await queryClient.setQueryData(
                        ['wallets', user?.accounts, wagmiAddress],
                        (oldData: interfaces.IWallet[] | undefined) =>
                            oldData?.map((w) =>
                                w.address === address
                                    ? {
                                          ...w,
                                          balances,
                                          balance: parseUnits(totalBalance.toString(), 6),
                                      }
                                    : w
                            )
                    )
                }
            } catch (error) {
                console.error('Error refetching balance:', error)
            }
        },
        [wallets, user?.accounts, wagmiAddress, queryClient]
    )

    const contextValue: WalletContextType = {
        wallets: processedWallets,
        selectedWallet,
        setSelectedWallet: (wallet: interfaces.IWallet) => {
            setSelectedAddress(wallet.address)
        },
        address: selectedWallet?.address,
        chain: PEANUT_WALLET_CHAIN,
        isConnected: selectedWallet?.connected || false,
        signInModal: {
            visible: promptWalletSigninOpen,
            open: () => setPromptWalletSigninOpen(true),
            close: () => setPromptWalletSigninOpen(false),
        },
        walletColor: selectedWallet?.address ? backgroundColorFromAddress(selectedWallet.address) : 'rgba(0,0,0,0)',
        refetchBalances,
        isPeanutWallet: isPeanut(selectedWallet),
        isExternalWallet: isExternalWallet(selectedWallet),
    }

    return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>
}

export const useWallet = (): WalletContextType => {
    const context = useContext(WalletContext)
    if (context === undefined) {
        throw new Error('useWallet must be used within an AuthProvider')
    }
    return context
}
