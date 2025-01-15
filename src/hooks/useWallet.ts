'use client'

import { useToast } from '@/components/0_Bruddle/Toast'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { peanutPublicClient } from '@/constants/viem.consts'
import { useAuth } from '@/context/authContext'
import * as interfaces from '@/interfaces'
import { useAppDispatch, useWalletStore } from '@/redux/hooks'
import { walletActions } from '@/redux/slices/wallet-slice'
import { areEvmAddressesEqual, backgroundColorFromAddress, fetchWalletBalances } from '@/utils'
import { useQuery } from '@tanstack/react-query'
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

export const useWallet = () => {
    const dispatch = useAppDispatch()
    const toast = useToast()
    const { address: kernelClientAddress, isKernelClientReady } = useZeroDev()
    const { isConnected: isWagmiConnected, addresses: wagmiAddresses, connector } = useAccount()
    const { addAccount, user } = useAuth()
    const { selectedAddress, wallets, signInModalVisible, walletColor } = useWalletStore()

    // use a ref to persist processed addresses across renders
    const processedAddressesRef = useRef(new Set<string>())

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
                      user.accounts
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
                          .map(async (account) => {
                              const dbWallet: interfaces.IDBWallet = {
                                  walletProviderType: account.account_type as unknown as interfaces.WalletProviderType,
                                  protocolType: interfaces.WalletProtocolType.EVM,
                                  address: account.account_identifier,
                                  connector: {
                                      iconUrl: connector?.icon || account.connector?.iconUrl!,
                                      name: connector?.name || account.connector?.name!,
                                  },
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
                                connector: {
                                    iconUrl: connector?.icon,
                                    name: connector?.name,
                                },
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

    useEffect(() => {
        if (!user || !wagmiAddresses || !wallets.length) return

        // create a Set of existing wallet addresses for faster lookup
        const existingAddresses = new Set(wallets.map((wallet) => wallet.address.toLowerCase()))

        // gilter and process new addresses only once
        const newAddresses = wagmiAddresses.filter((addr) => {
            const lowerAddr = addr.toLowerCase()
            if (!existingAddresses.has(lowerAddr) && !processedAddressesRef.current.has(lowerAddr)) {
                processedAddressesRef.current.add(lowerAddr)
                return true
            }
            return false
        })

        if (newAddresses.length) {
            const connectorInfo =
                connector && connector.icon
                    ? {
                          iconUrl: connector.icon,
                          name: connector.name,
                      }
                    : undefined

            // Promise.allSettled to ensure all API calls are handled correctly
            ;(async () => {
                const addAccountPromises = newAddresses.map((address) =>
                    addAccount({
                        accountIdentifier: address,
                        accountType: interfaces.WalletProviderType.BYOW,
                        userId: user.user.userId,
                        connector: connectorInfo,
                    }).catch((error) => {
                        console.error(`Error adding wallet ${address}:`, error)
                        const errorMsg = error.message.includes('Account already exists')
                            ? 'Could not add external wallet, already associated with another account'
                            : 'Unexpected error adding external wallet'
                        toast.error(errorMsg)
                    })
                )

                await Promise.allSettled(addAccountPromises)
            })()
        }
    }, [wagmiAddresses, user?.user.userId, wallets, connector])

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
    }
}
