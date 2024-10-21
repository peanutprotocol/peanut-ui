'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import * as interfaces from '@/interfaces'
import { useAccount } from 'wagmi'

// ZeroDev imports
import { useKernelClient } from "@zerodev/waas"

// TOOD: go through TODOs

// TODO: move to context consts
interface WalletContextType {
    activeWalletType: interfaces.WalletType | undefined
    setActiveWalletType: (walletType: interfaces.WalletType | null) => void
    isWalletConnected: boolean
    setIsWalletConnected: (isConnected: boolean) => void
    activeWallet: ActiveWallet|undefined
    setActiveWallet: (activeWallet: ActiveWallet|undefined) => void
    // addAccount: ({
    //     accountIdentifier,
    //     accountType,
    //     userId,
    // }: {
    //     accountIdentifier: string
    //     accountType: string
    //     userId: string
    // }) => Promise<void>
}
// TODO: move to context consts
interface ActiveWallet {
    activeWalletType: interfaces.WalletType | undefined
    // connected refers to the provider state
    //
    // The user may select a wallet but the provider may be connected
    // with another wallet. That would mean that: connected == False, in
    // this case. It will always be true if the active wallet is Peanut Wallet
    // and the user is logged in. That is because there is only one PW per user,
    // and the provider will always be connected to that.
    connected: boolean
    address: string | undefined
}


const WalletContext = createContext<WalletContextType | undefined>(undefined)

// TODO: change description
/**
 * Context provider to manage user authentication and profile interactions.
 * It handles fetching the user profile, updating user details (e.g., username, profile photo),
 * adding accounts and logging out. It also provides hooks for child components to access user data and auth-related functions.
 */
export const WalletProvider = ({ children }: { children: ReactNode }) => {

    ////// BYOW props
    //
    const { address: wagmiAddress, isConnected: isWagmiConnected, addresses} = useAccount()

    ////// context props
    //
    const [isWalletConnected, setIsWalletConnected] = useState<boolean>(false)
    const [activeWalletType, setActiveWalletType] = useState<interfaces.WalletType | undefined>(undefined)
    const [activeWallet, setActiveWallet] = useState<ActiveWallet|undefined>(undefined)  // TODO: this is the var that should be exposed for the app to consume, instead of const { address } = useAccount() anywhere
    // username keeps the current state of the passkey username
    //
    // it changes via the handle input during the Setup flow - at that time,
    // we prompt the user to create a new passkey through their OS and the
    // suggested username on that flow will come from this prop. At that point,
    // this prop and the user handle is the same. At this point, we could think
    // to update this prop w/ the handle value from authContext.tsx, every time there
    // is a new login and the user data is freshly updated. This wouldn't make sense
    // because the user may change their handle but NOT their passkey username (which
    // is mainly used in their OS to differentiate passkeys stored)
    const [username, setUsername] = useState<string>('')


    ////// ZeroDev props
    //
    const { address: kernelClientAddress, isConnected: isKernelClientConnected } = useKernelClient()

    ////// Lifecycle hooks
    //
    // TODO: we need to be performing a check if the connected address is the right address
    useEffect(() => {
        // called when BYOW changes
        console.log({isWagmiConnected})
        if (isWagmiConnected) {
            console.log({wagmiAddress, addresses})
        }
    }, [wagmiAddress])

    // TODO: add failure return type (what if checks fail, what do we return?)
    const activateWallet = (activeWalletType: interfaces.WalletType, address: string) => {
        if (activeWalletType == interfaces.WalletType.PEANUT) {
            if (isKernelClientConnected && kernelClientAddress == address) {
                setActiveWallet({
                    activeWalletType,
                    connected: true,
                    address: address
                })
            }
        } else if (activeWalletType == interfaces.WalletType.BYOW) {
            if (isWagmiConnected && wagmiAddress == address) {
                setActiveWallet({
                    activeWalletType,
                    connected: true,
                    address: address
                })
            } else {
                // TODO: return failure
            }
        }
    }

    const deactiveWalletOnLogout = () => {

    }

    return (
        <WalletContext.Provider
        value={{
            activeWalletType,
            setActiveWalletType,
            isWalletConnected, 
            setIsWalletConnected,
            activeWallet,
            setActiveWallet
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
