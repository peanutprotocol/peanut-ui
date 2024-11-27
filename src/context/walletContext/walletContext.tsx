'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import * as interfaces from '@/interfaces'
import { useAccount } from 'wagmi'

// ZeroDev imports
import { useZeroDev } from './zeroDevContext.context'
import { useQuery } from '@tanstack/react-query'
import { PEANUT_WALLET_CHAIN } from '@/constants'
import { Chain } from 'viem'
import { useAuth } from '../authContext'
import { backgroundColorFromAddress } from '@/utils'

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
}

function isPeanut(wallet: interfaces.IWallet | undefined) {
    return wallet?.walletProviderType === interfaces.WalletProviderType.PEANUT
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

// TODO: change description
/**
 * Context provider to manage user authentication and profile interactions.
 * It handles fetching the user profile, updating user details (e.g., username, profile photo),
 * adding accounts and logging out. It also provides hooks for child components to access user data and auth-related functions.
 */
export const WalletProvider = ({ children }: { children: ReactNode }) => {
    const [promptWalletSigninOpen, setPromptWalletSigninOpen] = useState(false)
    ////// ZeroDev props
    const { address: kernelClientAddress, isKernelClientReady } = useZeroDev()

    ////// BYOW props
    const { address: wagmiAddress, isConnected: isWagmiConnected } = useAccount()

    ////// User props
    const { addAccount, user } = useAuth()

    ////// Selected Wallet
    const [selectedWallet, setSelectedWallet] = useState<interfaces.IWallet | undefined>(undefined) // TODO: this is the var that should be exposed for the app to consume, instead of const { address } = useWallet() anywhere

    ////// Wallets
    const { data: wallets } = useQuery<interfaces.IWallet[]>({
        queryKey: ['wallets', user?.accounts, wagmiAddress],
        queryFn: async () => {
            // non users can connect BYOW (to pay a request for example)
            if (!user && wagmiAddress) {
                return [
                    {
                        walletProviderType: interfaces.WalletProviderType.BYOW,
                        protocolType: interfaces.WalletProtocolType.EVM,
                        address: wagmiAddress,
                        connected: false,
                    },
                ] as interfaces.IWallet[]
            }
            const processedWallets = user?.accounts
                .filter((account) =>
                    Object.values(interfaces.WalletProviderType).includes(
                        account.account_type as unknown as interfaces.WalletProviderType
                    )
                )
                .map((account) => ({
                    walletProviderType: account.account_type as unknown as interfaces.WalletProviderType,
                    protocolType: interfaces.WalletProtocolType.EVM,
                    address: account.account_identifier,
                    connected: false,
                }))
            return processedWallets ?? []
        },
    })

    const updateSelectedWalletWithConnectionStatus = useCallback(
        (wallet: interfaces.IWallet) => {
            if (isPeanut(wallet)) {
                wallet.connected = isKernelClientReady && kernelClientAddress == wallet.address
            } else {
                wallet.connected = isWagmiConnected && wagmiAddress == wallet.address
            }
            setSelectedWallet(wallet)
        },
        [isKernelClientReady, kernelClientAddress, isWagmiConnected, wagmiAddress]
    )

    /**
     * Update initial selected wallet
     */
    useEffect(() => {
        if (!selectedWallet && wallets && wallets.length > 0) {
            const wallet = wallets.find(isPeanut) ?? wallets[0]
            updateSelectedWalletWithConnectionStatus(wallet)
        }
    }, [wallets, selectedWallet])

    /**
     * Update selected wallet with connection status when kernel client is ready or wagmi is connected
     */
    useEffect(() => {
        if (selectedWallet) {
            updateSelectedWalletWithConnectionStatus(selectedWallet)
        }
    }, [kernelClientAddress, wagmiAddress, selectedWallet])

    /**
     * Add a new BYOW to DB and local wallets prop.
     * Called every time a new address is connected to the wagmi provider
     * Will add new BYOW only if:
     * - wagmiAddress is not undefined
     * - wallets are not undefined and user logged in (PW available, at least)
     */
    useEffect(() => {
        if (!user) return
        if (wagmiAddress && wallets && wallets.length > 0) {
            // only check if user logged in (wallets will always include PW in this case) and wallets have been set up
            const foundWallet = wallets.find((wallet: interfaces.IWallet) => {
                wallet.address == wagmiAddress
            })
            if (!foundWallet) {
                // if currConnectedBYOW is not already in wallets
                // addAccount() and then,
                // it does NOT need to add a new wallet to the wallets prop,
                // that is because addAccount() calls fetchUser() on success,
                // and accounts are populated anew
                addAccount({
                    accountIdentifier: wagmiAddress,
                    accountType: interfaces.WalletProviderType.BYOW,
                    userId: user.user.userId as string, // will always be defined, since user logged in
                })
            }
        }
    }, [wagmiAddress, wallets, user])

    const removeBYOW = async () => {
        // TODO: when successful API call, do NOT refetch all wallets (bad UX), but
        // go on the wallet list and remove wallet
        // TODO: if wallet connected to provider, disconnect wallet from provider
        // then
        // TODO: if active, default active -> PW if logged in, otherwise
        // if another wallet is connected to the provider, make that active, otherwise
        // no wallet active (have to review all props to ensure they are null)
    }

    return (
        <WalletContext.Provider
            value={{
                wallets:
                    wallets?.map((wallet: interfaces.IWallet) => {
                        let connected = false
                        if (isPeanut(wallet)) {
                            connected = isKernelClientReady && kernelClientAddress == wallet.address
                        } else {
                            connected = isWagmiConnected && wagmiAddress == wallet.address
                        }
                        return {
                            ...wallet,
                            connected,
                        }
                    }) || [],
                selectedWallet: selectedWallet && {
                    ...selectedWallet,
                    connected: isPeanut(selectedWallet)
                        ? isKernelClientReady && kernelClientAddress == selectedWallet.address
                        : isWagmiConnected && wagmiAddress == selectedWallet?.address,
                },
                setSelectedWallet: (wallet: interfaces.IWallet) => {
                    updateSelectedWalletWithConnectionStatus(wallet)
                },
                address: selectedWallet?.address,
                chain: PEANUT_WALLET_CHAIN,
                isConnected: selectedWallet?.connected || false,
                signInModal: {
                    visible: promptWalletSigninOpen,
                    open: () => setPromptWalletSigninOpen(true),
                    close: () => setPromptWalletSigninOpen(false),
                },
                walletColor: selectedWallet?.address
                    ? backgroundColorFromAddress(selectedWallet?.address)
                    : 'rgba(0,0,0,0)',
            }}
        >
            {children}
        </WalletContext.Provider>
    )
}

export const useWallet = (): WalletContextType => {
    const context = useContext(WalletContext)
    if (context === undefined) {
        throw new Error('useWallet must be used within an AuthProvider')
    }
    return context
}
