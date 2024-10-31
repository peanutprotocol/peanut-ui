'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import * as interfaces from '@/interfaces'
import { useAccount } from 'wagmi'

// ZeroDev imports
import { useZeroDev } from './zeroDevContext.context'
import { PasskeyStorage } from '@/components/Setup/Setup.helpers'
import { useAuth } from '../authContext'
import { useQuery } from '@tanstack/react-query'

interface WalletContextType {
    selectedWallet: interfaces.IWallet | undefined,
    setSelectedWallet: (wallet: interfaces.IWallet) => void,
    wallets: interfaces.IWallet[],
    // TODO: to refactor
    address?: string
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

// TODO: change description
/**
 * Context provider to manage user authentication and profile interactions.
 * It handles fetching the user profile, updating user details (e.g., username, profile photo),
 * adding accounts and logging out. It also provides hooks for child components to access user data and auth-related functions.
 */
export const WalletProvider = ({ children }: { children: ReactNode }) => {
    ////// ZeroDev props
    const { address: kernelClientAddress, isKernelClientReady } = useZeroDev()

    ////// Auth props
    const { user } = useAuth()

    ////// BYOW props
    const { address: wagmiAddress, isConnected: isWagmiConnected, addresses } = useAccount()

    ////// Selected Wallet
    const [selectedWallet, setSelectedWallet] = useState<interfaces.IWallet | undefined>(undefined)  // TODO: this is the var that should be exposed for the app to consume, instead of const { address } = useAccount() anywhere

    ////// Wallets
    const { data: wallets } = useQuery({
        queryKey: ["wallets", user?.user.userId],
        queryFn: async () => {
            /**
             * TODO: fetch wallets from backend
             * TODO: 2: Remove fetch & pass user?.account ?
            */
            const localPasskeys = PasskeyStorage.list()
            // const walletsResponse = await fetch('/api/peanut/user/get-wallets')
            // if (walletsResponse.ok) {
            //     // receive in backend format
            //     const { dbWallets }: { dbWallets: interfaces.IDBWallet[] } = await walletsResponse.json()
            //     // manipulate to frontend format (add connected attribute)
            //     const wallets: interfaces.IWallet[] = dbWallets.map((dbWallet: interfaces.IDBWallet) => ({
            //         ...dbWallet,
            //         connected: false    // this property will be processed into accurate values later in the flow
            //     }))
            // }
            return [
                // { 
                //     walletProviderType: interfaces.WalletProviderType.BYOW,
                //     protocolType: interfaces.WalletProtocolType.EVM,
                //     connected: false,
                //     address: '0x7D4c7063E003CeB8B9413f63569e7AB968AF3714'
                // },
                ...localPasskeys.map(({ handle, account }) => ({
                    walletProviderType: interfaces.WalletProviderType.PEANUT,
                    protocolType: interfaces.WalletProtocolType.EVM,
                    connected: false,
                    address: account,
                    handle
                }))
            ]
        }
    })

    useEffect(() => {
        if (!selectedWallet && wallets && wallets.length > 0) {
            const wallet = wallets[0];

            const isPeanut = wallet.walletProviderType == interfaces.WalletProviderType.PEANUT
            if (isPeanut) {
                wallet.connected = isKernelClientReady && kernelClientAddress == wallet.address
            } else {
                wallet.connected = isWagmiConnected && wagmiAddress == wallet.address
            }

            setSelectedWallet(wallet)
        }
    }, [wallets])


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
                wallets: wallets?.map((wallet: interfaces.IWallet) => {
                    let connected = false
                    const isPeanut = wallet.walletProviderType == interfaces.WalletProviderType.PEANUT
                    if (isPeanut) {
                        connected = isKernelClientReady && kernelClientAddress == wallet.address
                    } else {
                        connected = isWagmiConnected && wagmiAddress == wallet.address
                    }
                    return {
                        ...wallet,
                        connected
                    }
                }) || [],
                selectedWallet,
                setSelectedWallet,
                address: selectedWallet?.address
            }}>
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
