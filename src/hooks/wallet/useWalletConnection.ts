'use client'

import { useToast } from '@/components/0_Bruddle/Toast'
import { useAuth } from '@/context/authContext'
import * as interfaces from '@/interfaces'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'

export const useWalletConnection = () => {
    const { open: openWeb3Modal } = useAppKit()
    const { status, address: connectedAddress } = useAppKitAccount()
    const { user, addAccount, fetchUser } = useAuth()
    const toast = useToast()

    const processedAddresses = useRef(new Set<string>())
    const isProcessing = useRef(false)

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
                })
                await fetchUser()
                processedAddresses.current.add(lowerAddress)
                toast.success('Wallet added successfully')
                return true
            } catch (error) {
                console.error('Error adding wallet:', error)
                toast.error('Failed to add wallet')
                return false
            } finally {
                isProcessing.current = false
            }
        },
        [user, addAccount, fetchUser, toast, isAddressInUserAccounts]
    )

    // automatically add connected wallet to backend if not already present
    useEffect(() => {
        if (connectedAddress && !userAddresses.includes(connectedAddress.toLowerCase())) {
            addWalletToBackend(connectedAddress)
        }
    }, [connectedAddress, userAddresses])

    // connect wallet and add it to backend
    const connectWallet = useCallback(async () => {
        try {
            await openWeb3Modal({ view: 'Connect' })

            // todo: not a very elegant solution, but it works, need to refine this later
            // wait for connection and attempt to add wallet
            for (let attempt = 0; attempt < 10 && !isProcessing.current; attempt++) {
                if (status === 'connected' && connectedAddress) {
                    await addWalletToBackend(connectedAddress)
                    break
                }
                await new Promise((resolve) => setTimeout(resolve, 500))
            }
        } catch (error) {
            console.error('Connection error:', error)
            toast.error('Failed to connect wallet')
        }
    }, [openWeb3Modal, status, connectedAddress, addWalletToBackend, toast])

    return {
        connectWallet,
        isConnecting: status === 'connecting' || isProcessing.current,
        connectionStatus: status,
    }
}
