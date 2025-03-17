'use client'

import { PeanutArmHoldingBeer } from '@/assets'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS, peanutPublicClient } from '@/constants'
import { useAuth } from '@/context/authContext'
import {
    AccountType,
    IDBWallet,
    IUserBalance,
    IUserProfile,
    IWallet,
    WalletProtocolType,
    WalletProviderType,
} from '@/interfaces'
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
const isPeanut = (wallet?: IDBWallet): boolean => wallet?.walletProviderType === WalletProviderType.PEANUT

const isExternalWallet = (wallet?: IDBWallet): boolean => wallet?.walletProviderType === WalletProviderType.BYOW

const isSmartAccount = (wallet?: IDBWallet): boolean =>
    wallet?.walletProviderType === WalletProviderType.PEANUT ||
    wallet?.walletProviderType === WalletProviderType.REWARDS

const idForWallet = (wallet: Pick<IDBWallet, 'walletProviderType' | 'address'>) =>
    `${wallet.walletProviderType}-${wallet.address}`

export const byTypeAndConnectionStatus = (a: IWallet, b: IWallet) => {
    if (a.walletProviderType === WalletProviderType.PEANUT) {
        return -1
    } else if (b.walletProviderType === WalletProviderType.PEANUT) {
        return 1
    }
    if (a.connected && !b.connected) {
        return -1
    } else if (!a.connected && b.connected) {
        return 1
    }
    return 0
}

const createDefaultDBWallet = (
    address: string,
    walletProviderType: WalletProviderType,
    protocolType: WalletProtocolType,
    connector: { iconUrl: string; name: string }
): IDBWallet => ({
    walletProviderType,
    protocolType,
    address,
    connector: {
        iconUrl: connector.iconUrl,
        name: connector.name,
    },
})

const REWARD_WALLETS: Omit<IWallet, 'address'>[] = [
    {
        walletProviderType: WalletProviderType.REWARDS,
        protocolType: WalletProtocolType.EVM,
        connector: {
            iconUrl: PeanutArmHoldingBeer,
            name: 'Beer Wallet',
        },
        balance: BigInt(0),
        connected: true,
        balances: [],
        id: 'pinta-wallet',
    },
]

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

    const { selectedWalletId, wallets, signInModalVisible, walletColor, isFetchingWallets } = useWalletStore()

    const getUserAccount = useCallback(
        (user: IUserProfile, address: string) =>
            user?.accounts.find((acc: any) => acc.account_identifier.toLowerCase() === address.toLowerCase()),
        [user]
    )

    const isWalletConnected = useCallback(
        (wallet: IDBWallet): boolean => {
            if (!wallet) return false

            // check for rewards wallet first
            if (wallet.walletProviderType === WalletProviderType.REWARDS) {
                return true // always connected
            }

            // check for Peanut wallet
            if (wallet.walletProviderType === WalletProviderType.PEANUT && kernelClientAddress) {
                return isKernelClientReady && areEvmAddressesEqual(kernelClientAddress, wallet.address)
            }

            // check for external wallets
            if (wagmiAddress && wallet.walletProviderType === WalletProviderType.BYOW) {
                return isWagmiConnected && wagmiAddress.some((addr) => areEvmAddressesEqual(addr, wallet.address))
            }

            return false
        },
        [isKernelClientReady, kernelClientAddress, isWagmiConnected, wagmiAddress]
    )

    const fetchWalletDetails = useCallback(
        async (address: string, walletProviderType: WalletProviderType): Promise<IWallet> => {
            // get connector details from user accounts
            const userAccount = user ? getUserAccount(user, address) : null

            const dbWallet: IDBWallet = createDefaultDBWallet(
                address,
                walletProviderType,
                WalletProtocolType.EVM,
                userAccount?.connector || {
                    iconUrl: connector?.icon || '',
                    name: connector?.name || 'External Wallet',
                }
            )

            let balance = BigInt(0)
            let balances: IUserBalance[] | undefined

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

            return {
                ...dbWallet,
                balance,
                balances,
                connected: isWalletConnected(dbWallet as IWallet),
                id: idForWallet(dbWallet),
            }
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
                    Object.values(WalletProviderType).includes(account.account_type as unknown as WalletProviderType)
                )
                .sort((a, b) => {
                    if (AccountType.PEANUT_WALLET === a.account_type) {
                        return -1
                    } else if (AccountType.PEANUT_WALLET === b.account_type) {
                        return 1
                    }
                    const dateA = new Date(a.created_at)
                    const dateB = new Date(b.created_at)
                    return dateA.getTime() - dateB.getTime()
                })
                .map((account) =>
                    fetchWalletDetails(
                        account.account_identifier,
                        account.account_type as unknown as WalletProviderType
                    )
                )
        )
        const processedExternalWallets = await Promise.all(
            wagmiAddressesList
                .filter((address) => {
                    return !processedAccounts.some((w) => areEvmAddressesEqual(w.address, address))
                })
                .map((address) => fetchWalletDetails(address, WalletProviderType.BYOW))
        )

        const mergedWallets: IWallet[] = [...processedAccounts, ...processedExternalWallets]

        const peanutWallet = mergedWallets.find((w) => w.walletProviderType === WalletProviderType.PEANUT)
        if (peanutWallet) {
            mergedWallets.push(...REWARD_WALLETS.map((w) => ({ ...w, address: peanutWallet.address })))
        }

        mergedWallets.sort(byTypeAndConnectionStatus)
        dispatch(walletActions.setWallets(mergedWallets))
        dispatch(walletActions.setIsFetchingWallets(false))
        return mergedWallets
    }, [fetchWalletDetails, wagmiAddress, user, user?.accounts])

    const { isLoading: isWalletsQueryLoading } = useQuery({
        queryKey: ['wallets', user, user?.accounts, wagmiAddress],
        queryFn: mergeAndProcessWallets,
        enabled: !!wagmiAddress || !!user,
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 1 * 60 * 1000, // 1 minute
    })

    useEffect(() => {
        if (isWalletsQueryLoading) {
            dispatch(walletActions.setIsFetchingWallets(true))
        }
    }, [isWalletsQueryLoading])

    const selectedWallet = useMemo(() => {
        if (!selectedWalletId || !wallets.length) return undefined
        const wallet = wallets.find((w) => w.id === selectedWalletId)
        if (!wallet) {
            dispatch(walletActions.setSelectedWalletId(undefined))
            return undefined
        }
        return { ...wallet, connected: isWalletConnected(wallet) }
    }, [selectedWalletId, wallets, isWalletConnected])

    useEffect(() => {
        const connectedExternalWallet = wallets.find(
            (wallet) => wallet.walletProviderType === WalletProviderType.BYOW && isWalletConnected(wallet)
        )

        const isValidSelection =
            selectedWallet &&
            ((selectedWallet.id.startsWith('peanut-wallet') &&
                selectedWallet.walletProviderType === WalletProviderType.PEANUT) ||
                (selectedWallet.id === 'pinta-wallet' &&
                    selectedWallet.walletProviderType === WalletProviderType.REWARDS) ||
                (selectedWallet.walletProviderType === WalletProviderType.BYOW && isWalletConnected(selectedWallet)))

        if (!selectedWallet || !isValidSelection) {
            if (connectedExternalWallet) {
                dispatch(walletActions.setSelectedWalletId(connectedExternalWallet.id))
            } else {
                const peanutWallet = wallets.find(
                    (wallet) =>
                        wallet.id.startsWith('peanut-wallet') && wallet.walletProviderType === WalletProviderType.PEANUT
                )
                if (peanutWallet) {
                    dispatch(walletActions.setSelectedWalletId(peanutWallet.id))
                }
            }
        }
    }, [wallets, isWalletConnected, selectedWallet])

    useEffect(() => {
        if (selectedWallet?.address) {
            dispatch(walletActions.setWalletColor(backgroundColorFromAddress(selectedWallet.address)))
        }
    }, [selectedWallet])

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
            dispatch(
                walletActions.setSelectedWalletId(
                    idForWallet({ address: wagmiAddress[0], walletProviderType: WalletProviderType.BYOW })
                )
            )
        }
    }, [wagmiAddress])

    return {
        wallets,
        selectedWallet,
        setSelectedWallet: (wallet: IWallet) => {
            dispatch(walletActions.setSelectedWalletId(wallet.id))
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
        isSmartAccount: isSmartAccount(selectedWallet),
        selectExternalWallet,
        isWalletConnected,
        isFetchingWallets: isFetchingWallets || isWalletsQueryLoading,
        byTypeAndConnectionStatus,
    }
}
