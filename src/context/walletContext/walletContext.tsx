'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import * as interfaces from '@/interfaces'
import { useAccount } from 'wagmi'

// ZeroDev imports
import { useKernelClient } from "@zerodev/waas"
import { useZeroDev } from './zeroDevContext.context'

// TOOD: go through TODOs

// TODO: remove any unused imports
// TODO: move to context consts
interface WalletContextType {
    // active wallet
    address: string | undefined
    activeWalletType: interfaces.WalletProviderType | undefined
    isWalletConnected: boolean
    activeWallet: interfaces.IWallet | undefined,
    isActiveWalletPW: boolean,
    isActiveWalletBYOW: boolean,

    // wallets
    wallets: interfaces.IWallet[],
    areWalletsFetched: boolean,
    areWalletsFetchedAndSetup: boolean,
    isFetchingWallets: boolean,

    // functions
    checkActivateWallet: (wallet: interfaces.IWallet) => Promise<interfaces.IWallet | undefined>
    deactiveWalletsOnLogout: () => void,
    setupWalletsAfterLogin: () => void
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
    // 
    // Wallets
    //
    const [wallets, setWallets] = useState<interfaces.IWallet[]>([])
    const [areWalletsFetched, setAreWalletsFetched] = useState<boolean>(false)
    const [areWalletsFetchedAndSetup, setAreWalletsFetchedAndSetup] = useState<boolean>(false)
    const [isFetchingWallets, setIsFetchingWallets] = useState<boolean>(false)

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
    const {address: kernelClientAddress, isKernelClientReady, handleLogin} = useZeroDev()

    ////// Lifecycle hooks
    //
    // TODO: we need to be performing a check if the connected address is the right address
    useEffect(() => {
        // called when BYOW changes
        if (isWagmiConnected) {
            console.log({wagmiAddress, addresses})
        }
    }, [wagmiAddress]) // TODO: remove this hook

    ////// Utility functions
    //

    const throwWalletError = (walletErrorType: interfaces.WalletErrorType) => {
        throw new interfaces.WalletError(
            walletErrorType
        )
    }



    ////// Logic hooks
    //

    // handles checks:
    // PW:
    //      - kernel not ready
    // BYOW:
    //      - wagmi not connected
    //      - wagmi connected to wrong wallet
    // throws WalletError in case of error which is an 'undefined' return
    const checkActivateWallet = async (wallet: interfaces.IWallet): Promise<interfaces.IWallet | undefined> => {
        if (wallet.walletProviderType == interfaces.WalletProviderType.PEANUT) {
            if (isKernelClientReady && kernelClientAddress == wallet.address) {
                return activateWallet(wallet)
            } else {
                throwWalletError(interfaces.WalletErrorType.PW_KERNEL_NOT_READY)
            }
        } else if (wallet.walletProviderType == interfaces.WalletProviderType.BYOW) {
            if (isWagmiConnected) {
                if (wagmiAddress == wallet.address) {
                    return activateWallet(wallet)
                } else {
                    throwWalletError(interfaces.WalletErrorType.BYOB_CONNECTED_TO_WRONG_WALLET)
                }
            } else {
                throwWalletError(interfaces.WalletErrorType.BYOB_NOT_CONNECTED)
            }
        } else {
            throwWalletError(interfaces.WalletErrorType.PROVIDER_TYPE_ERROR)
        }
    }

    // TODO: add failure return type (what if checks fail, what do we return?)
    const activateWallet = async (wallet: interfaces.IWallet): Promise<interfaces.IWallet | undefined> => {
        if (wallet.walletProviderType == interfaces.WalletProviderType.PEANUT) {
            setIsActiveWalletPW(true)
            setIsActiveWalletBYOW(false)
        } else if (wallet.walletProviderType == interfaces.WalletProviderType.BYOW) {
            // deactivate current active wallet
            if (activeWallet) {
                activeWallet.connected = false
            }
            setIsActiveWalletBYOW(true)
            setIsActiveWalletPW(false)
        } else {
            throwWalletError(interfaces.WalletErrorType.PROVIDER_TYPE_ERROR)
        }
        setActiveWallet(wallet)
        setAddress(wallet.address)
        return wallet
    }

    const deactiveWalletsOnLogout = () => {
        // TODO: makes PW disconnected
        // TODO: makes areWalletsFetched and areWalletsFetchedAndSetup false
    }

    // TODO: this is called by auth - ensure it's always authed before calling
    // 1. fetches wallets .then()
        // sets PW as connected in wallet list (does it by address of passkey connected, bc in the
        // future we may have many PWs)
        // sets any wallet that has the same address as a wagmiConnected wallet (already connected wagmi provider)
    // 2. set PW as active wallet
    //
    // note: calls inside may throw WalletError
    // we expect to do catching in UI to handle accordingly
    const setupWalletsAfterLogin = async () => {
        try {
            // fetch wallets
            const fetchedWallets = await fetchWallets()
            // TODO: handle that it throws error, also
            // needs to set setAreWalletsFetchedAndSetup(false)

            if (fetchedWallets) {
                // sets PW as connected in wallet list
                const pWallet = fetchedWallets.find((wallet: interfaces.IWallet) => wallet.address == kernelClientAddress)
                pWallet!.connected = true

                // sets any wallet that has the same address as a wagmiConnected wallet
                if (isWagmiConnected) {
                    fetchedWallets.find((wallet: interfaces.IWallet) => wallet.address == wagmiAddress)!.connected = true
                }

                setAreWalletsFetchedAndSetup(true)
                setWallets(fetchedWallets)
        
                // sets PW as active wallet
                checkActivateWallet(pWallet!)
            } else {
                // it always throws, so handled on try-catch
            }


        } catch (error) {
            if (error instanceof interfaces.WalletError) {

            } else {
                throw error
            }
        }
        
    }

    // sets and returns wallets if successful call
    // doesn't set wallets and returns null if failure call
    // returns undefined (doesn't actually) when throwing, otherwise returns IWallet
    const fetchWallets = async (): Promise<interfaces.IWallet[] | undefined> => {
        const wallies = [
            {
                walletProviderType: interfaces.WalletProviderType.PEANUT,
                protocolType: interfaces.WalletProtocolType.EVM,
                connected: false,
                address: '0xE6e8fB6461DA2f05379e9EC9FA4C886010ebf9ab'
            },
            {   // 
                walletProviderType: interfaces.WalletProviderType.BYOW,
                protocolType: interfaces.WalletProtocolType.EVM,
                connected: false,
                address: '0x7D4c7063E003CeB8B9413f63569e7AB968AF3714'
            },
            {
                walletProviderType: interfaces.WalletProviderType.BYOW,
                protocolType: interfaces.WalletProtocolType.EVM,
                connected: false,
                address: '0x92D2d247b5ba2de168DbCFBf339Df4fAC49a9f70'
            }
        ]
        return wallies
        setIsFetchingWallets(true)
        const walletsResponse = await fetch('/api/peanut/user/get-wallets')
        if (walletsResponse.ok) {
            // receive in backend format
            const { dbWallets } : {dbWallets: interfaces.IDBWallet[]} = await walletsResponse.json()
            // manipulate to frontend format (add connected attribute)
            const wallets: interfaces.IWallet[] = dbWallets.map((dbWallet: interfaces.IDBWallet) => ({
                ...dbWallet,
                connected: false    // this property will be processed into accurate values later in the flow
            }))
            setWallets(wallets)
            setIsFetchingWallets(false)
            setAreWalletsFetched(true)
            return wallets
        } else {
            setIsFetchingWallets(false)
            setAreWalletsFetched(false)
            throwWalletError(interfaces.WalletErrorType.WALLET_FETCH_ERROR)
        }
    }

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
            // active wallet
            address,
            activeWalletType,
            isWalletConnected, 
            activeWallet,
            isActiveWalletPW,
            isActiveWalletBYOW,

            // wallets
            wallets,
            areWalletsFetched,
            areWalletsFetchedAndSetup,
            isFetchingWallets,

            // functions
            checkActivateWallet,
            deactiveWalletsOnLogout,
            setupWalletsAfterLogin
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
