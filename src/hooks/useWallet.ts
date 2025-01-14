'use client'

import { useToast } from '@/components/0_Bruddle/Toast'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { peanutPublicClient } from '@/constants/viem.consts'
import { useAuth } from '@/context/authContext'
import * as interfaces from '@/interfaces'
import { useAppDispatch, useWalletStore } from '@/redux/hooks'
import { walletActions } from '@/redux/slices/wallet-slice'
import { areEvmAddressesEqual, backgroundColorFromAddress, fetchWalletBalances } from '@/utils'
import { identicon } from '@dicebear/collection'
import { createAvatar } from '@dicebear/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
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

export const useWallet = () => {
    const dispatch = useAppDispatch()
    const queryClient = useQueryClient()
    const toast = useToast()
    const { address: kernelClientAddress, isKernelClientReady } = useZeroDev()
    const { isConnected: isWagmiConnected, addresses: wagmiAddresses, connector } = useAccount()
    const { addAccount, user } = useAuth()
    const { selectedAddress, wallets, signInModalVisible, walletColor } = useWalletStore()

    const getWalletIcon = useCallback(
        (address: string) => {
            if (connector?.icon) return connector.icon

            return createAvatar(identicon, { seed: address.toLowerCase(), size: 128 }).toDataUri()
        },
        [connector]
    )

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

    useQuery({
        queryKey: ['wallets', user?.accounts, wagmiAddresses],
        queryFn: async () => {
            if (!user && !wagmiAddresses) return []

            const processedWallets = user
                ? await Promise.all(
                      user.accounts.map(async (account) => {
                          const dbWallet: interfaces.IDBWallet = {
                              walletProviderType: account.account_type as unknown as interfaces.WalletProviderType,
                              protocolType: interfaces.WalletProtocolType.EVM,
                              address: account.account_identifier,
                              walletIcon: getWalletIcon(account.account_identifier),
                          }

                          let balance = BigInt(0)
                          let balances: interfaces.IUserBalance[] | undefined

                          if (isPeanut(dbWallet)) {
                              balance = await peanutPublicClient.readContract({
                                  address: PEANUT_WALLET_TOKEN,
                                  abi: erc20Abi,
                                  functionName: 'balanceOf',
                                  args: [getAddress(dbWallet.address)],
                              })
                          } else {
                              const { balances: fetchedBalances, totalBalance } = await fetchWalletBalances(
                                  dbWallet.address
                              )
                              balances = fetchedBalances
                              balance = parseUnits(totalBalance.toString(), 6)
                          }

                          return { ...dbWallet, balance, balances, connected: isWalletConnected(dbWallet) }
                      })
                  )
                : wagmiAddresses
                  ? await Promise.all(
                        wagmiAddresses.map(async (address) => {
                            const { balances, totalBalance } = await fetchWalletBalances(address)
                            return {
                                ...createDefaultDBWallet(address),
                                connected: isWalletConnected(createDefaultDBWallet(address)),
                                balances,
                                balance: parseUnits(totalBalance.toString(), PEANUT_WALLET_TOKEN_DECIMALS),
                            }
                        })
                    )
                  : []

            dispatch(walletActions.setWallets(processedWallets))
            return processedWallets
        },
    })

    const selectedWallet = useMemo(() => {
        if (!selectedAddress || !wallets.length) return undefined
        const wallet = wallets.find((w) => w.address === selectedAddress)
        return wallet ? { ...wallet, connected: isWalletConnected(wallet) } : undefined
    }, [selectedAddress, wallets, isWalletConnected])

    useEffect(() => {
        if (!selectedAddress && wallets.length) {
            const initialWallet = wallets.find(isPeanut) || wallets[0]
            dispatch(walletActions.setSelectedAddress(initialWallet.address))
        }
    }, [wallets, selectedAddress, dispatch])

    useEffect(() => {
        if (selectedWallet?.address) {
            dispatch(walletActions.setWalletColor(backgroundColorFromAddress(selectedWallet.address)))
        }
    }, [selectedWallet, dispatch])

    useEffect(() => {
        if (!user || !wagmiAddresses || !wallets.length) return

        const newAddresses = wagmiAddresses.filter(
            (addr) => !wallets.some((wallet) => areEvmAddressesEqual(addr, wallet.address))
        )
        if (newAddresses.length) {
            newAddresses.forEach((address) => {
                addAccount({
                    accountIdentifier: address,
                    accountType: interfaces.WalletProviderType.BYOW,
                    userId: user.user.userId,
                }).catch((error) => {
                    const errorMsg = error.message.includes('Account already exists')
                        ? 'Could not add external wallet, already associated with another account'
                        : 'Unexpected error adding external wallet'
                    toast.error(errorMsg)
                })
            })
        }
    }, [wagmiAddresses, wallets, user, addAccount, toast])

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
                            balance: parseUnits(totalBalance.toString(), 6),
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
    }
}
