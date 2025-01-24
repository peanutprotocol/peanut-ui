'use client'

import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { peanutPublicClient } from '@/constants/viem.consts'
import { useAuth } from '@/context/authContext'
import * as interfaces from '@/interfaces'
import { useAppDispatch, useWalletStore } from '@/redux/hooks'
import { walletActions } from '@/redux/slices/wallet-slice'
import { areEvmAddressesEqual, backgroundColorFromAddress, fetchWalletBalances } from '@/utils'
import { useAppKitAccount } from '@reown/appkit/react'
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

const createDefaultDBWallet = (address: string): interfaces.IDBWallet => ({
    walletProviderType: interfaces.WalletProviderType.BYOW,
    protocolType: interfaces.WalletProtocolType.EVM,
    address,
})

export const useWallet = () => {
    const dispatch = useAppDispatch()
    const { user } = useAuth()
    const { address: kernelClientAddress, isKernelClientReady } = useZeroDev()
    const { addresses: wagmiAddress, connector } = useAccount()
    const { isConnected: isWagmiConnected } = useAppKitAccount()

    const { selectedAddress, wallets, signInModalVisible, walletColor } = useWalletStore()

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
        const wagmiAddressesList = wagmiAddress || []

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
    }, [fetchWalletDetails, wagmiAddress, user?.accounts, dispatch])

    useQuery({
        queryKey: ['wallets', user?.accounts, wagmiAddress],
        queryFn: mergeAndProcessWallets,
        enabled: !!user || !!wagmiAddress,
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 1 * 60 * 1000, // 1 minute
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
