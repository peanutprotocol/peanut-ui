'use client'

import { useToast } from '@/components/0_Bruddle/Toast'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { peanutPublicClient } from '@/constants/viem.consts'
import * as interfaces from '@/interfaces'
import {
    areEvmAddressesEqual,
    backgroundColorFromAddress,
    fetchWalletBalances,
    getUserPreferences,
    updateUserPreferences,
} from '@/utils'
import { identicon } from '@dicebear/collection'
import { createAvatar } from '@dicebear/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Chain, erc20Abi, getAddress, parseUnits } from 'viem'
import { useAccount } from 'wagmi'
import { useAuth } from '../authContext'
import { useZeroDev } from './zeroDevContext.context'

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
    selectExternalWallet: () => void
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
    const toast = useToast()
    const [promptWalletSigninOpen, setPromptWalletSigninOpen] = useState(false)
    ////// ZeroDev props
    const { address: kernelClientAddress, isKernelClientReady } = useZeroDev()

    ////// BYOW props
    const { isConnected: isWagmiConnected, addresses: wagmiAddresses, connector } = useAccount()

    ////// User props
    const { addAccount, user } = useAuth()

    const [selectedAddress, setSelectedAddress] = useState<string | undefined>(
        getUserPreferences()?.lastSelectedWallet?.address
    )

    // generate fallback avatar
    const getWalletIcon = useCallback(
        (address: string) => {
            if (!!connector?.icon) {
                return connector?.icon
            }

            const avatar = createAvatar(identicon, {
                seed: address.toLowerCase(),
                size: 128,
            })

            return avatar.toDataUri()
        },
        [connector]
    )

    const isWalletConnected = useCallback(
        (wallet: interfaces.IDBWallet): boolean => {
            if (isPeanut(wallet) && kernelClientAddress) {
                return isKernelClientReady && areEvmAddressesEqual(kernelClientAddress, wallet.address)
            } else if (wagmiAddresses) {
                return (
                    isWagmiConnected && wagmiAddresses.some((address) => areEvmAddressesEqual(address, wallet.address))
                )
            }
            return false
        },
        [isKernelClientReady, kernelClientAddress, isWagmiConnected, wagmiAddresses]
    )

    const createDefaultDBWallet = (address: string): interfaces.IDBWallet => ({
        walletProviderType: interfaces.WalletProviderType.BYOW,
        protocolType: interfaces.WalletProtocolType.EVM,
        address,
    })

    const { data: wallets = [] } = useQuery<interfaces.IWallet[]>({
        queryKey: ['wallets', user?.accounts, wagmiAddresses],
        queryFn: async () => {
            // non users can connect BYOW (to pay a request for example)
            if (!user) {
                if (!wagmiAddresses) return []

                return Promise.all(
                    wagmiAddresses.map(async (address) => {
                        const { balances, totalBalance } = await fetchWalletBalances(address)
                        return {
                            ...createDefaultDBWallet(address),
                            connected: isWalletConnected(createDefaultDBWallet(address)),
                            balances,
                            balance: parseUnits(totalBalance.toString(), PEANUT_WALLET_TOKEN_DECIMALS),
                        }
                    })
                )
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
                        walletIcon: getWalletIcon(account.account_identifier),
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
        if (!user || !wagmiAddresses || !wallets.length) return

        const newAddresses = wagmiAddresses.filter(
            (address) => !wallets.some((wallet) => areEvmAddressesEqual(address, wallet.address))
        )
        if (newAddresses.length > 0) {
            newAddresses.forEach((address) => {
                addAccount({
                    accountIdentifier: address,
                    accountType: interfaces.WalletProviderType.BYOW,
                    userId: user.user.userId as string,
                }).catch((error: Error) => {
                    if (error.message.includes('Account already exists')) {
                        toast.error('Could not add external wallet, already associated with another account')
                    } else {
                        toast.error('Unexpected error adding external wallet')
                    }
                })
            })
        }
    }, [wagmiAddresses, wallets, user])

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
                        ['wallets', user?.accounts, wagmiAddresses],
                        (oldData: interfaces.IWallet[] | undefined) =>
                            oldData?.map((w) => (w.address === address ? { ...w, balance } : w))
                    )
                } else {
                    const { balances, totalBalance } = await fetchWalletBalances(address)

                    await queryClient.setQueryData(
                        ['wallets', user?.accounts, wagmiAddresses],
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
        [wallets, user?.accounts, wagmiAddresses, queryClient]
    )

    const selectExternalWallet = useCallback(() => {
        if (wagmiAddresses && wagmiAddresses.length > 0) {
            setSelectedAddress(wagmiAddresses[0])
        }
    }, [wagmiAddresses])

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
        selectExternalWallet,
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
