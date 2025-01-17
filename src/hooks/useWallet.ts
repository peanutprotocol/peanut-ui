'use client'

import { useToast } from '@/components/0_Bruddle/Toast'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { peanutPublicClient } from '@/constants/viem.consts'
import { useAuth } from '@/context/authContext'
import * as interfaces from '@/interfaces'
import { useAppDispatch, useWalletStore } from '@/redux/hooks'
import { walletActions } from '@/redux/slices/wallet-slice'
import { areEvmAddressesEqual, backgroundColorFromAddress, fetchWalletBalances } from '@/utils'
import { useAppKit, useDisconnect } from '@reown/appkit/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { erc20Abi, getAddress, parseUnits } from 'viem'
import { useAccount } from 'wagmi'
import { useZeroDev } from './useZeroDev'

// utility functions
const isPeanut = (wallet?: interfaces.IDBWallet): boolean =>
    wallet?.walletProviderType === interfaces.WalletProviderType.PEANUT

const isExternalWallet = (wallet?: interfaces.IDBWallet): boolean =>
    wallet?.walletProviderType === interfaces.WalletProviderType.BYOW

const createDefaultDBWallet = (address: string): interfaces.IDBWallet => ({
    walletProviderType: interfaces.WalletProviderType.BYOW,
    protocolType: interfaces.WalletProtocolType.EVM,
    address,
})

const useAddWalletAccount = () => {
    const { addAccount, user, fetchUser } = useAuth()
    const toast = useToast()

    // keep track of processed addresses to prevent duplicate calls
    const processedAddresses = useRef(new Set<string>())

    return useMutation({
        mutationFn: async ({
            address,
            providerType,
        }: {
            address: string
            providerType: interfaces.WalletProviderType
        }) => {
            if (!user) {
                throw new Error('Please log in first')
            }

            if (!address) {
                throw new Error('No wallet address provided')
            }

            const lowerAddress = address.toLowerCase()

            // Check if we've already processed this address in this session
            if (processedAddresses.current.has(lowerAddress)) {
                return { address, providerType }
            }

            // Check if wallet already exists in user accounts
            const existingAddresses = new Set(user.accounts.map((acc) => acc.account_identifier.toLowerCase()))

            if (existingAddresses.has(lowerAddress)) {
                throw new Error('This wallet is already associated with your account')
            }

            // Add to processed set before making the API call
            processedAddresses.current.add(lowerAddress)

            await addAccount({
                accountIdentifier: address,
                accountType: providerType,
                userId: user.user.userId,
            })

            return { address, providerType }
        },
        onSuccess: async () => {
            await fetchUser()
        },
        onError: (error: Error) => {
            if (error.message.includes('Account already exists')) {
                toast.error('This wallet is already associated with another account.')
            } else {
                toast.error(error.message)
            }
        },
    })
}

// First, create a new hook to manage wallet connections
export const useWalletConnection = () => {
    const { disconnect } = useDisconnect()
    const { open: openWeb3Modal } = useAppKit()
    const { isConnected: isWagmiConnected, address: connectedWalletAddress } = useAccount()
    const addWalletMutation = useAddWalletAccount()
    const { user } = useAuth()
    const toast = useToast()

    // Add a ref to track if we're in the process of adding a new wallet
    const isAddingNewWallet = useRef(false)

    const connectWallet = useCallback(async () => {
        try {
            // Set the flag when we're explicitly trying to add a new wallet
            isAddingNewWallet.current = true

            // 1. Ensure any existing connection is cleared
            if (isWagmiConnected) {
                await disconnect()
                // Wait for disconnect to complete
                await new Promise((resolve) => setTimeout(resolve, 500))
            }

            // 2. Open modal and wait for connection
            await openWeb3Modal()

            // 3. Wait for connection to be established
            await new Promise((resolve) => setTimeout(resolve, 2000))

            // 4. Verify and add the new wallet if needed
            const newAddress = connectedWalletAddress
            if (!newAddress) {
                console.log('No wallet address received')
                return
            }

            // Only proceed with account addition if we're explicitly adding a new wallet
            if (isAddingNewWallet.current) {
                // Check if wallet is already in user's accounts
                const isExistingAccount = user?.accounts.some(
                    (acc) => acc.account_identifier.toLowerCase() === newAddress.toLowerCase()
                )

                // Only add to backend if it's a new account
                if (isExistingAccount) {
                    return
                }

                console.log('Adding new wallet to backend:', newAddress)
                await addWalletMutation.mutateAsync({
                    address: newAddress,
                    providerType: interfaces.WalletProviderType.BYOW,
                })
                // } else {
                //     console.log('Wallet already exists in user accounts:', newAddress)
                // }
            }
        } catch (error) {
            console.error('Connection error:', error)
            if (error instanceof Error) {
                toast.error(error.message)
            } else {
                toast.error('Failed to connect wallet')
            }
        } finally {
            // Reset the flag when we're done
            isAddingNewWallet.current = false
        }
    }, [openWeb3Modal, disconnect, connectedWalletAddress, addWalletMutation, user?.accounts])

    const disconnectWallet = useCallback(async () => {
        // Ensure we're not in adding mode when disconnecting
        isAddingNewWallet.current = false
        if (isWagmiConnected) {
            await disconnect()
        }
    }, [disconnect, isWagmiConnected])

    return {
        connectWallet,
        disconnectWallet,
        isConnecting: addWalletMutation.isPending,
    }
}

export const useWallet = () => {
    const dispatch = useAppDispatch()
    const { user } = useAuth()
    const { address: kernelClientAddress, isKernelClientReady } = useZeroDev()
    const { isConnected: isWagmiConnected, addresses: wagmiAddresses, connector } = useAccount()

    const { selectedAddress, wallets, signInModalVisible, walletColor } = useWalletStore()

    const isWalletConnected = useCallback(
        (wallet: interfaces.IDBWallet): boolean => {
            if (isPeanut(wallet) && kernelClientAddress) {
                return isKernelClientReady && areEvmAddressesEqual(kernelClientAddress, wallet.address)
            }
            if (wagmiAddresses) {
                return isWagmiConnected && wagmiAddresses.some((addr) => areEvmAddressesEqual(addr, wallet.address))
            }
            return false
        },
        [isKernelClientReady, kernelClientAddress, isWagmiConnected, wagmiAddresses]
    )

    const fetchWalletDetails = useCallback(
        async (address: string, walletProviderType: interfaces.WalletProviderType) => {
            const dbWallet: interfaces.IDBWallet = {
                walletProviderType,
                protocolType: interfaces.WalletProtocolType.EVM,
                address,
                connector: {
                    iconUrl: connector?.icon || '',
                    name: connector?.name || 'External Wallet',
                },
            }

            let balance = BigInt(0)
            let balances: interfaces.IUserBalance[] | undefined

            if (isPeanut(dbWallet)) {
                balance = await peanutPublicClient.readContract({
                    address: PEANUT_WALLET_TOKEN,
                    abi: erc20Abi,
                    functionName: 'balanceOf',
                    args: [getAddress(address)],
                })
            } else {
                const { balances: fetchedBalances, totalBalance } = await fetchWalletBalances(address)
                balances = fetchedBalances
                balance = parseUnits(totalBalance.toString(), PEANUT_WALLET_TOKEN_DECIMALS)
            }

            return { ...dbWallet, balance, balances, connected: isWalletConnected(dbWallet) }
        },
        [connector, isWalletConnected]
    )

    const mergeAndProcessWallets = useCallback(async () => {
        const userAccounts = user?.accounts || []
        const wagmiAddressesList = wagmiAddresses || []

        const processedAccounts = await Promise.all(
            userAccounts
                .filter((account) =>
                    Object.values(interfaces.WalletProviderType).includes(
                        account.account_type as unknown as interfaces.WalletProviderType
                    )
                )
                .sort((a, b) => {
                    if (interfaces.AccountType.PEANUT_WALLET === a.account_type) {
                        return -1
                    } else if (interfaces.AccountType.PEANUT_WALLET === b.account_type) {
                        return 1
                    }
                    const dateA = new Date(a.created_at)
                    const dateB = new Date(b.created_at)
                    return dateA.getTime() - dateB.getTime()
                })
                .map((account) =>
                    fetchWalletDetails(
                        account.account_identifier,
                        account.account_type as unknown as interfaces.WalletProviderType
                    )
                )
        )

        const processedExternalWallets = await Promise.all(
            wagmiAddressesList.map((address) => fetchWalletDetails(address, interfaces.WalletProviderType.BYOW))
        )

        const mergedWallets = [...processedAccounts, ...processedExternalWallets].reduce((unique, wallet) => {
            if (!unique.some((w) => areEvmAddressesEqual(w.address, wallet.address))) {
                unique.push(wallet)
            }
            return unique
        }, [] as interfaces.IDBWallet[])

        dispatch(walletActions.setWallets(mergedWallets))
        return mergedWallets
    }, [fetchWalletDetails, wagmiAddresses, user?.accounts, dispatch])

    useQuery({
        queryKey: ['wallets', user?.accounts, wagmiAddresses],
        queryFn: mergeAndProcessWallets,
        enabled: !!user || !!wagmiAddresses,
    })

    const selectedWallet = useMemo(() => {
        if (!selectedAddress || !wallets.length) return undefined
        const wallet = wallets.find((w) => w.address === selectedAddress)
        return wallet ? { ...wallet, connected: isWalletConnected(wallet) } : undefined
    }, [selectedAddress, wallets, isWalletConnected])

    useEffect(() => {
        if (!selectedAddress && wallets.length) {
            const initialWallet = wallets.find(isPeanut) || wallets[0]
            if (initialWallet) {
                dispatch(walletActions.setSelectedAddress(initialWallet.address))
            }
        }
    }, [wallets, selectedAddress, dispatch])

    useEffect(() => {
        if (selectedWallet?.address) {
            dispatch(walletActions.setWalletColor(backgroundColorFromAddress(selectedWallet.address)))
        }
    }, [selectedWallet, dispatch])

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
                    dispatch(walletActions.updateWalletBalance({ address, balance }))
                } else {
                    const { balances, totalBalance } = await fetchWalletBalances(address)
                    dispatch(
                        walletActions.updateWalletBalance({
                            address,
                            balances,
                            balance: parseUnits(totalBalance.toString(), PEANUT_WALLET_TOKEN_DECIMALS),
                        })
                    )
                }
            } catch (error) {
                console.error('Error refetching balance:', error)
            }
        },
        [wallets, dispatch]
    )

    const selectExternalWallet = useCallback(() => {
        if (wagmiAddresses?.length) {
            dispatch(walletActions.setSelectedAddress(wagmiAddresses[0]))
        }
    }, [wagmiAddresses, dispatch])

    return {
        wallets,
        selectedWallet,
        setSelectedWallet: (wallet: interfaces.IWallet) => {
            dispatch(walletActions.setSelectedAddress(wallet.address))
        },
        address: selectedWallet?.address,
        chain: PEANUT_WALLET_CHAIN,
        isConnected: !!selectedWallet?.connected,
        signInModal: {
            visible: signInModalVisible,
            open: () => dispatch(walletActions.setSignInModalVisible(true)),
            close: () => dispatch(walletActions.setSignInModalVisible(false)),
        },
        walletColor,
        refetchBalances,
        isPeanutWallet: isPeanut(selectedWallet),
        isExternalWallet: isExternalWallet(selectedWallet),
        selectExternalWallet,
        isWalletConnected,
    }
}
