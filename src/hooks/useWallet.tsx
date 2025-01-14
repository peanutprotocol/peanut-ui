import { useToast } from '@/components/0_Bruddle/Toast'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { peanutPublicClient } from '@/constants/viem.consts'
import { useAuth } from '@/context/authContext'
import { useZeroDev } from '@/context/walletContext/zeroDevContext.context'
import { IDBWallet, IUserBalance, IWallet, WalletProtocolType, WalletProviderType } from '@/interfaces'
import { useWalletStore } from '@/redux/hooks'
import { walletActions } from '@/redux/slices/wallet-slice'
import { areEvmAddressesEqual, backgroundColorFromAddress, fetchWalletBalances, updateUserPreferences } from '@/utils'
import { identicon } from '@dicebear/collection'
import { createAvatar } from '@dicebear/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import { useDispatch } from 'react-redux'
import { erc20Abi, getAddress, parseUnits } from 'viem'
import { useAccount } from 'wagmi'

const createDefaultDBWallet = (address: string): IDBWallet => ({
    walletProviderType: WalletProviderType.BYOW,
    protocolType: WalletProtocolType.EVM,
    address,
})

function isPeanut(wallet: IDBWallet | undefined) {
    return wallet?.walletProviderType === WalletProviderType.PEANUT
}

export const useWallet = () => {
    const dispatch = useDispatch()
    const queryClient = useQueryClient()
    const toast = useToast()
    const walletState = useWalletStore()

    const { address: kernelClientAddress, isKernelClientReady } = useZeroDev()
    const { isConnected: isWagmiConnected, addresses: wagmiAddresses, connector } = useAccount()
    const { addAccount, user } = useAuth()

    const getWalletIcon = useCallback(
        (address: string) => {
            if (!!connector?.icon) {
                return connector?.icon
            }

            const avatar = createAvatar(identicon, {
                seed: address.toLowerCase(),
                size: 128,
            })

            return avatar.toDataUri()
        },
        [connector]
    )

    const isWalletConnected = useCallback(
        (wallet: IDBWallet): boolean => {
            if (isPeanut(wallet) && kernelClientAddress) {
                return isKernelClientReady && areEvmAddressesEqual(kernelClientAddress, wallet.address)
            } else if (wagmiAddresses) {
                return (
                    isWagmiConnected && wagmiAddresses.some((address) => areEvmAddressesEqual(address, wallet.address))
                )
            }
            return false
        },
        [isKernelClientReady, kernelClientAddress, isWagmiConnected, wagmiAddresses]
    )

    // fetch wallets using react-query
    const { data: wallets = [] } = useQuery<IWallet[]>({
        queryKey: ['wallets', user?.accounts, wagmiAddresses],
        queryFn: async () => {
            if (!user) {
                if (!wagmiAddresses) return []

                return Promise.all(
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
            }

            const processedWallets = user.accounts
                .filter((account) =>
                    Object.values(WalletProviderType).includes(account.account_type as unknown as WalletProviderType)
                )
                .map(async (account) => {
                    const dbWallet: IDBWallet = {
                        walletProviderType: account.account_type as unknown as WalletProviderType,
                        protocolType: WalletProtocolType.EVM,
                        address: account.account_identifier,
                        walletIcon: getWalletIcon(account.account_identifier),
                    }

                    let balance = BigInt(0)
                    let balances: IUserBalance[] | undefined

                    if (isPeanut(dbWallet)) {
                        balance = await peanutPublicClient.readContract({
                            address: PEANUT_WALLET_TOKEN,
                            abi: erc20Abi,
                            functionName: 'balanceOf',
                            args: [getAddress(dbWallet.address)],
                        })
                    } else {
                        // for BYOW wallets, fetch all balances
                        const { balances: fetchedBalances, totalBalance } = await fetchWalletBalances(dbWallet.address)
                        balances = fetchedBalances
                        balance = parseUnits(totalBalance.toString(), 6)
                    }

                    const wallet: IWallet = {
                        ...dbWallet,
                        balance,
                        balances,
                        connected: false,
                    }

                    return wallet
                })

            const resolvedWallets = await Promise.all(processedWallets)
            // convert to serializable format
            const serializedWallets = resolvedWallets.map((wallet) => ({
                ...wallet,
                balance: wallet.balance.toString(), // convert to string for Redux
            }))
            // dispatch serialized wallets to Redux
            dispatch(walletActions.setWallets(serializedWallets))
            // return the original wallets for react-query
            return resolvedWallets
        },
    })

    const refetchBalances = async (address: string) => {
        const wallet = walletState.wallets.find((w) => w.address === address)
        if (!wallet) return

        try {
            if (wallet.walletProviderType === WalletProviderType.PEANUT) {
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
    }

    const selectExternalWallet = useCallback(() => {
        if (wagmiAddresses && wagmiAddresses.length > 0) {
            const wallet = walletState.wallets.find((w) => w.address === wagmiAddresses[0])
            if (wallet) {
                dispatch(
                    walletActions.setSelectedWallet({
                        ...wallet,
                        balance: wallet.balance.toString(),
                    })
                )
            }
        }
    }, [wagmiAddresses, walletState.wallets, dispatch])

    useEffect(() => {
        if (!walletState.selectedWallet && walletState.wallets.length > 0) {
            const initialWallet = walletState.wallets.find(isPeanut) ?? walletState.wallets[0]
            dispatch(
                walletActions.setSelectedWallet({
                    ...initialWallet,
                    balance: initialWallet.balance.toString(),
                })
            )
        }
    }, [walletState.wallets, walletState.selectedWallet, dispatch])

    useEffect(() => {
        if (walletState.selectedWallet?.address) {
            updateUserPreferences({
                lastSelectedWallet: { address: walletState.selectedWallet.address },
            })
        }
    }, [walletState.selectedWallet?.address])

    const processedWallets = useMemo(
        () =>
            walletState.wallets.map((wallet) => ({
                ...wallet,
                balance: BigInt(wallet.balance),
                connected: isWalletConnected(wallet),
            })),
        [walletState.wallets, isWalletConnected]
    )

    const selectedWallet = useMemo(() => {
        if (!walletState.selectedWallet || !processedWallets.length) return undefined
        const wallet = processedWallets.find((w) => w.address === walletState.selectedWallet?.address)
        if (!wallet) return undefined

        return {
            ...wallet,
            balance: BigInt(wallet.balance),
            connected: isWalletConnected(wallet),
        }
    }, [walletState.selectedWallet, processedWallets, isWalletConnected])

    // add new BYOW wallet when connected
    useEffect(() => {
        if (!user || !wagmiAddresses || !walletState.wallets.length) return

        const newAddresses = wagmiAddresses.filter(
            (address) => !walletState.wallets.some((wallet) => areEvmAddressesEqual(address, wallet.address))
        )
        if (newAddresses.length > 0) {
            newAddresses.forEach((address) => {
                addAccount({
                    accountIdentifier: address,
                    accountType: WalletProviderType.BYOW,
                    userId: user.user.userId as string,
                }).catch((error: Error) => {
                    if (error.message.includes('Account already exists')) {
                        toast.error('Could not add external wallet, already associated with another account')
                    } else {
                        toast.error('Unexpected error adding external wallet')
                    }
                })
            })
        }
    }, [wagmiAddresses, walletState.wallets, user, addAccount, toast])

    return {
        ...walletState,
        wallets: processedWallets,
        selectedWallet,
        address: selectedWallet?.address,
        walletColor: walletState.selectedWallet?.address
            ? backgroundColorFromAddress(walletState.selectedWallet.address)
            : 'rgba(0,0,0,0)',
        chain: PEANUT_WALLET_CHAIN,
        isConnected: walletState.selectedWallet?.connected || false,
        isPeanutWallet: walletState.selectedWallet?.walletProviderType === WalletProviderType.PEANUT,
        isExternalWallet: walletState.selectedWallet?.walletProviderType === WalletProviderType.BYOW,
        refetchBalances,
        selectExternalWallet,
        setSelectedWallet: (wallet: IWallet) =>
            dispatch(
                walletActions.setSelectedWallet({
                    ...wallet,
                    balance: wallet.balance.toString(), // convert BigInt to string before dispatch
                })
            ),
        signInModal: {
            visible: walletState.signInModalVisible,
            open: () => dispatch(walletActions.setSignInModalVisible(true)),
            close: () => dispatch(walletActions.setSignInModalVisible(false)),
        },
    }
}
