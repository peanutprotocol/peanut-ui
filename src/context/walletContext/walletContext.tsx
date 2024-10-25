'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import * as interfaces from '@/interfaces'
import { useAccount } from 'wagmi'

// ZeroDev imports
import { useKernelClient } from "@zerodev/waas"
import { useZeroDev } from './zeroDevContext.context'
import { useAuth } from '../authContext'

// TOOD: go through TODOs

// TODO: remove any unused imports
// TODO: move to context consts
interface WalletContextType {
    address: string | undefined
    activeWalletType: interfaces.WalletProviderType | undefined
    isWalletConnected: boolean
    activeWallet: interfaces.IWallet | undefined,
    isActiveWalletPW: boolean,
    isActiveWalletBYOW: boolean,
    activateWallet: (activeWalletType: interfaces.WalletProviderType, address: string) => void
    deactiveWalletsOnLogout: () => void
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

// TODO: change description
/**
 * Context provider to manage user authentication and profile interactions.
 * It handles fetching the user profile, updating user details (e.g., username, profile photo),
 * adding accounts and logging out. It also provides hooks for child components to access user data and auth-related functions.
 */
export const WalletProvider = ({ children }: { children: ReactNode }) => {

    ////// Auth props
    //
    const { isAuthed } = useAuth()

    ////// BYOW props
    //
    const { address: wagmiAddress, isConnected: isWagmiConnected, addresses} = useAccount()

    ////// context props
    //
    // Active wallet
    //
    const [address, setAddress] = useState<string | undefined>(undefined)       // mapped to the activeWallet's address at all times
    const [isWalletConnected, setIsWalletConnected] = useState<boolean>(false)
    const [activeWalletType, setActiveWalletType] = useState<interfaces.WalletProviderType | undefined>(undefined)
    const [isActiveWalletPW, setIsActiveWalletPW] = useState<boolean>(false)
    const [isActiveWalletBYOW, setIsActiveWalletBYOW] = useState<boolean>(false)
    const [activeWallet, setActiveWallet] = useState<interfaces.IWallet | undefined>(undefined)  // TODO: this is the var that should be exposed for the app to consume, instead of const { address } = useAccount() anywhere
    const [isFetchingWallets, setIsFetchingWallets] = useState<boolean>(false)
    // 
    // Wallets
    //
    const [wallets, setWallets] = useState<interfaces.IWallet[]>([])

    // TODO: integrate username w/ Handle view
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
    const {address: kernelClientAddress, isKernelClientReady} = useZeroDev()

    ////// Lifecycle hooks
    //
    // TODO: we need to be performing a check if the connected address is the right address
    useEffect(() => {
        // called when BYOW changes
        console.log({isWagmiConnected})
        if (isWagmiConnected) {
            console.log({wagmiAddress, addresses})
        }
    }, [wagmiAddress]) // TODO: remove this hook


    ////// Logic hooks
    //

    // TODO: add failure return type (what if checks fail, what do we return?)
    const activateWallet = (walletProviderType: interfaces.WalletProviderType, address: string) => {
        if (walletProviderType == interfaces.WalletProviderType.PEANUT) {
            if (isKernelClientReady && kernelClientAddress == address) {
                setActiveWallet({
                    walletProviderType,
                    connected: true,
                    address: address
                })
                setAddress(address)
                setIsActiveWalletPW(true)
                setIsActiveWalletBYOW(false)
                // TODO: return success
            }
        } else if (walletProviderType == interfaces.WalletProviderType.BYOW) {
            if (isWagmiConnected && wagmiAddress == address) {
                setActiveWallet({
                    walletProviderType,
                    connected: true,
                    address: address
                })
                setAddress(address)
                setIsActiveWalletBYOW(true)
                setIsActiveWalletPW(false)
                // TODO: return success
            }
        }
        // TODO: return failure
    }

    const deactiveWalletsOnLogout = () => {

    }

    // sets and returns wallets if successful call
    // doesn't set wallets and returns null if failure call
    const fetchWallets = async (): Promise<interfaces.IWallet[] | null> => {
        setIsFetchingWallets(true)
        try {
            if (isAuthed) {
                const walletsResponse = await fetch('/api/peanut/user/get-wallets')
                if (walletsResponse.ok) {
                    const { wallets } : {wallets: interfaces.IWallet[]} = await walletsResponse.json()
                    setWallets(wallets)
                    setIsFetchingWallets(false)
                    return wallets
                } else {
                    console.warn('Failed to fetch user wallets.')
                }
            }
        } catch (error) {
            console.error('ERROR WHEN FETCHING USER', error)
        } finally {
            setIsFetchingWallets(false)
            return null
        }
    }

    const removeBYOW = async () => {
        // TODO: when successful API call, do NOT refetch all wallets (bad UX), but
        // go on the wallet list and remove wallet
    }


    return (
        <WalletContext.Provider
        value={{
            address,
            activeWalletType,
            isWalletConnected, 
            activeWallet,
            isActiveWalletPW,
            isActiveWalletBYOW,
            activateWallet,
            deactiveWalletsOnLogout
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
