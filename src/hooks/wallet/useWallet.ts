'use client'

import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { peanutPublicClient } from '@/constants/viem.consts'
import { useAuth } from '@/context/authContext'
import * as interfaces from '@/interfaces'
import { useAppDispatch, useWalletStore } from '@/redux/hooks'
import { walletActions } from '@/redux/slices/wallet-slice'
import { areEvmAddressesEqual, backgroundColorFromAddress, fetchWalletBalances } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import { erc20Abi, getAddress, parseUnits } from 'viem'
import { useAccount } from 'wagmi'
import { useZeroDev } from '../useZeroDev'

// utility functions
const isPeanut = (wallet?: interfaces.IDBWallet): boolean =>
    wallet?.walletProviderType === interfaces.WalletProviderType.PEANUT

const isExternalWallet = (wallet?: interfaces.IDBWallet): boolean =>
    wallet?.walletProviderType === interfaces.WalletProviderType.BYOW

const createDefaultDBWallet = (
    address: string,
    walletProviderType: interfaces.WalletProviderType,
    protocolType: interfaces.WalletProtocolType,
    connector: { iconUrl: string; name: string }
): interfaces.IDBWallet => ({
    walletProviderType,
    protocolType,
    address,
    connector: {
        iconUrl: connector.iconUrl,
        name: connector.name,
    },
})

export const useWallet = () => {
    const dispatch = useAppDispatch()
    const { user } = useAuth()
    const { address: kernelClientAddress, isKernelClientReady } = useZeroDev()
    const {
        addresses: wagmiAddress,
        connector,
        isConnected: isWagmiConnected,
        address: externalWalletAddress,
        chain: wagmiChain,
    } = useAccount()

    const { selectedAddress, wallets, signInModalVisible, walletColor, isFetchingWallets } = useWalletStore()

    const getUserAccount = useCallback(
        (user: interfaces.IUserProfile, address: string) =>
            user?.accounts.find((acc: any) => acc.account_identifier.toLowerCase() === address.toLowerCase()),
        [user]
    )

    const isWalletConnected = useCallback(
        (wallet: interfaces.IDBWallet): boolean => {
            if (isPeanut(wallet) && kernelClientAddress) {
                return isKernelClientReady && areEvmAddressesEqual(kernelClientAddress, wallet.address)
            }
            if (wagmiAddress && wallet) {
                return isWagmiConnected && wagmiAddress.some((addr) => areEvmAddressesEqual(addr, wallet.address))
            }
            return false
        },
        [isKernelClientReady, kernelClientAddress, isWagmiConnected, wagmiAddress]
    )

    const fetchWalletDetails = useCallback(
        async (address: string, walletProviderType: interfaces.WalletProviderType) => {
            // get connector details from user accounts
            const userAccount = user ? getUserAccount(user, address) : null

            const dbWallet: interfaces.IDBWallet = createDefaultDBWallet(
                address,
                walletProviderType,
                interfaces.WalletProtocolType.EVM,
                userAccount?.connector || {
                    iconUrl: connector?.icon || '',
                    name: connector?.name || 'External Wallet',
                }
            )

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
        [connector, isWalletConnected, user?.accounts]
    )

    const mergeAndProcessWallets = useCallback(async () => {
        dispatch(walletActions.setIsFetchingWallets(true))
        const userAccounts = user?.accounts || []
        const wagmiAddressesList = wagmiAddress || []

        // process user accounts
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

        // process external wallets - based on user login status
        const processedExternalWallets = await Promise.all(
            wagmiAddressesList
                .filter((address) => {
                    // if user is logged in, only process wallets from userAccounts
                    // if user is not logged in, process all connected wallets
                    return user
                        ? userAccounts.some((acc) => areEvmAddressesEqual(acc.account_identifier, address))
                        : true
                })
                .map((address) => fetchWalletDetails(address, interfaces.WalletProviderType.BYOW))
        )

        const mergedWallets = [...processedAccounts, ...processedExternalWallets].reduce((unique, wallet) => {
            if (!unique.some((w) => areEvmAddressesEqual(w.address, wallet.address))) {
                unique.push(wallet)
            }
            return unique
        }, [] as interfaces.IDBWallet[])

        dispatch(walletActions.setWallets(mergedWallets))
        dispatch(walletActions.setIsFetchingWallets(false))
        return mergedWallets
    }, [fetchWalletDetails, wagmiAddress, user, user?.accounts, dispatch])

    const { isLoading: isWalletsQueryLoading } = useQuery({
        queryKey: ['wallets', user?.accounts, wagmiAddress],
        queryFn: mergeAndProcessWallets,
        enabled: !!wagmiAddress || !!user,
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 1 * 60 * 1000, // 1 minute
    })

    useEffect(() => {
        if (isWalletsQueryLoading) {
            dispatch(walletActions.setIsFetchingWallets(true))
        }
    }, [isWalletsQueryLoading, dispatch])

    const selectedWallet = useMemo(() => {
        if (!selectedAddress || !wallets.length) return undefined
        const wallet = wallets.find((w) => w.address === selectedAddress)
        if (!wallet) {
            // The selected address does not correspond to any wallet
            dispatch(walletActions.setSelectedAddress(undefined))
            return undefined
        }
        return { ...wallet, connected: isWalletConnected(wallet) }
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
                Sentry.captureException(error)
                console.error('Error refetching balance:', error)
            }
        },
        [wallets]
    )

    const selectExternalWallet = useCallback(() => {
        if (wagmiAddress?.length) {
            dispatch(walletActions.setSelectedAddress(wagmiAddress[0]))
        }
    }, [wagmiAddress, dispatch])

    return {
        wallets,
        selectedWallet,
        setSelectedWallet: (wallet: interfaces.IWallet) => {
            dispatch(walletActions.setSelectedAddress(wallet.address))
        },
        address: selectedWallet?.address || externalWalletAddress,
        chain: isPeanut(selectedWallet) ? PEANUT_WALLET_CHAIN : wagmiChain,
        isConnected: !!selectedWallet?.connected || !!isWagmiConnected,
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
        isFetchingWallets: isFetchingWallets || isWalletsQueryLoading,
    }
}
