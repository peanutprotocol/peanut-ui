'use client'

import { useToast } from '@/components/0_Bruddle/Toast'
import { useAuth } from '@/context/authContext'
import * as interfaces from '@/interfaces'
import { useAppDispatch } from '@/redux/hooks'
import { walletActions } from '@/redux/slices/wallet-slice'
import { useAppKit, useAppKitAccount, useDisconnect } from '@reown/appkit/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useAccount } from 'wagmi'

export const useWalletConnection = () => {
    const { open: openWalletModal } = useAppKit()
    const { disconnect: disconnectWallet } = useDisconnect()
    const { status, address: connectedAddress } = useAppKitAccount()
    const { connector } = useAccount()
    const { user, addAccount, fetchUser } = useAuth()
    const toast = useToast()
    const dispatch = useAppDispatch()

    const processedAddresses = useRef(new Set<string>())
    const isProcessing = useRef(false)
    const isAddingWallet = useRef(false)

    // helper function to check if an address already exists in user accounts
    const isAddressInUserAccounts = useCallback(
        (address: string) =>
            user?.accounts.some((acc) => acc.account_identifier.toLowerCase() === address.toLowerCase()),
        [user]
    )

    // Memoized list of user addresses
    const userAddresses = useMemo(() => user?.accounts.map((acc) => acc.account_identifier.toLowerCase()) || [], [user])

    // add wallet to backend and fetch updated user data
    const addWalletToBackend = useCallback(
        async (address: string) => {
            const lowerAddress = address.toLowerCase()
            if (!address || !user || isProcessing.current || processedAddresses.current.has(lowerAddress)) {
                return false
            }

            if (isAddressInUserAccounts(lowerAddress)) {
                processedAddresses.current.add(lowerAddress)
                return false
            }

            try {
                isProcessing.current = true
                await addAccount({
                    accountIdentifier: address,
                    accountType: interfaces.WalletProviderType.BYOW,
                    userId: user.user.userId,
                    connector: connector && {
                        iconUrl: connector.icon || '',
                        name: connector.name,
                    },
                })
                await fetchUser()
                processedAddresses.current.add(lowerAddress)
                return true
            } catch (error) {
                if (error?.toString().includes('Account already exists')) {
                    // remove the wallet from the store
                    dispatch(walletActions.removeWallet(lowerAddress))
                    processedAddresses.current.add(lowerAddress)
                    return false
                }
                throw error
            } finally {
                isProcessing.current = false
            }
        },
        [user, addAccount, fetchUser, toast, isAddressInUserAccounts, dispatch, connector]
    )

    // automatically add connected wallet to backend if not already present
    useEffect(() => {
        const addWallets = async () => {
            if (!connectedAddress || !user || isAddingWallet.current) return

            const connectedWalletAddress = connectedAddress.toLowerCase()
            if (
                !userAddresses.includes(connectedWalletAddress) &&
                !processedAddresses.current.has(connectedWalletAddress)
            ) {
                isAddingWallet.current = true
                await addWalletToBackend(connectedAddress)
                isAddingWallet.current = false
            }
        }

        addWallets()
    }, [connectedAddress, userAddresses])

    // connect wallet and add it to backend
    const connectWallet = useCallback(async () => {
        if (status === 'connected' && connectedAddress) {
            await disconnectWallet()
        }

        await openWalletModal({ view: 'Connect' })

        if (status === 'connected' && connectedAddress) {
            const successful = await addWalletToBackend(connectedAddress)
            if (successful) {
                toast.success('Wallet added successfully')
            } else {
                toast.error('This wallet is already associated with another account.')
            }
        }
    }, [openWalletModal, status, connectedAddress, addWalletToBackend, toast, disconnectWallet])

    return {
        connectWallet,
        isConnecting: status === 'connecting' || isProcessing.current,
        connectionStatus: status,
    }
}
