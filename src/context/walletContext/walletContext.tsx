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
 * 
 * 
 * 
 */
export const WalletProvider = ({ children }: { children: ReactNode }) => {
    ////// ZeroDev props
    const { address: kernelClientAddress, isKernelClientReady } = useZeroDev()

    ////// Auth props
    const { user } = useAuth()

    ////// BYOW props
    const { address: wagmiAddress, isConnected: isWagmiConnected } = useAccount()

    ////// Selected Wallet
    const [selectedWallet, setSelectedWallet] = useState<interfaces.IWallet | undefined>(undefined)  // TODO: this is the var that should be exposed for the app to consume, instead of const { address } = useAccount() anywhere

    ////// Wallets
    const { data: wallets } = useQuery<interfaces.IWallet[]>({
        queryKey: ["wallets", user?.user.userId],
        queryFn: async () => {
            const processedWallets = user?.accounts.filter(
                account => Object.values(interfaces.WalletProviderType).includes(account.account_type)
            ).map(account=> ({
                walletProviderType: account.account_type,
                protocolType: account.chain,
                address: account.account_identifier,
                connected: false
            }))
            return processedWallets ? processedWallets : []
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
