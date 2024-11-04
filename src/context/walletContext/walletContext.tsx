'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react'
import * as interfaces from '@/interfaces'
import { useAccount } from 'wagmi'

// ZeroDev imports
import { useZeroDev } from './zeroDevContext.context'
import { PasskeyStorage } from '@/components/Setup/Setup.helpers'
import { useQuery } from '@tanstack/react-query'
import { PEANUT_WALLET_CHAIN } from '@/constants'
import { Chain } from 'viem'
import { useRouter } from 'next/navigation'
import { backgroundColorFromAddress } from '@/utils'
import { useAuth } from '../authContext'

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

const WalletContext = createContext<WalletContextType | undefined>(undefined)

// TODO: change description
/**
 * Context provider to manage user authentication and profile interactions.
 * It handles fetching the user profile, updating user details (e.g., username, profile photo),
 * adding accounts and logging out. It also provides hooks for child components to access user data and auth-related functions.
 */
export const WalletProvider = ({ children }: { children: ReactNode }) => {
    const [promptWalletSigninOpen, setPromptWalletSigninOpen] = useState(false)
    const { push } = useRouter()
    ////// ZeroDev props
    const { address: kernelClientAddress, isKernelClientReady } = useZeroDev()

    ////// BYOW props
    const { address: wagmiAddress, isConnected: isWagmiConnected } = useAccount()

    ////// User props
    const { user } = useAuth()

    ////// Selected Wallet
    const [selectedWallet, setSelectedWallet] = useState<interfaces.IWallet | undefined>(undefined) // TODO: this is the var that should be exposed for the app to consume, instead of const { address } = useWallet() anywhere

    const legacy_getLocalPWs = () => {
        const localPasskeys = PasskeyStorage.list()
        return [
            ...localPasskeys.map(({ handle, account }) => ({
                walletProviderType: interfaces.WalletProviderType.PEANUT,
                protocolType: interfaces.WalletProtocolType.EVM,
                connected: false,
                address: account,
                handle,
            })),
        ]
    }

    ////// Wallets
    const { data: wallets } = useQuery<interfaces.IWallet[]>({
        queryKey: ['wallets', user?.user.userId],
        queryFn: () => {
            const processedWallets = user?.accounts
                .filter((account) => Object.values(interfaces.WalletProviderType).includes(account.account_type))
                .map((account) => ({
                    walletProviderType: account.account_type,
                    protocolType: account.chain,
                    address: account.account_identifier,
                    connected: false,
                }))
            return processedWallets ? processedWallets : []
        },
    })

    const updateSelectedWalletWithConnectionStatus = useCallback(
        (wallet: interfaces.IWallet) => {
            const isPeanut = wallet.walletProviderType == interfaces.WalletProviderType.PEANUT
            if (isPeanut) {
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
            const wallet = wallets[0]

            updateSelectedWalletWithConnectionStatus(wallet)
        }
    }, [wallets])

    /**
     * Update selected wallet with connection status when kernel client is ready or wagmi is connected
     */
    useEffect(() => {
        if (selectedWallet) {
            updateSelectedWalletWithConnectionStatus(selectedWallet)
        }
    }, [kernelClientAddress, wagmiAddress])

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
                        const isPeanut = wallet.walletProviderType == interfaces.WalletProviderType.PEANUT
                        if (isPeanut) {
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
                    connected:
                        selectedWallet?.walletProviderType == interfaces.WalletProviderType.PEANUT
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
                walletColor: backgroundColorFromAddress(selectedWallet?.address || ''),
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
