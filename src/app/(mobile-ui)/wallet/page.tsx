'use client'

import { ARBITRUM_ICON } from '@/assets'
import { Button } from '@/components/0_Bruddle'
import DirectionalActionButtons from '@/components/Global/DirectionalActionButtons'
import NoDataEmptyState from '@/components/Global/EmptyStates/NoDataEmptyState'
import Icon from '@/components/Global/Icon'
import { ListItemView } from '@/components/Global/ListItemView'
import NavHeader from '@/components/Global/NavHeader'
import { WalletCard } from '@/components/Home/WalletCard'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN_DECIMALS, PEANUT_WALLET_TOKEN_NAME } from '@/constants'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useWalletConnection } from '@/hooks/wallet/useWalletConnection'
import { IWallet, WalletProviderType } from '@/interfaces'
import { useWalletStore } from '@/redux/hooks'
import { formatAmount, getChainName, getHeaderTitle, getUserPreferences, updateUserPreferences } from '@/utils'
import { useDisconnect } from '@reown/appkit/react'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { formatUnits } from 'viem'

const WalletDetailsPage = () => {
    const pathname = usePathname()
    const { disconnect } = useDisconnect()
    const { focusedWallet } = useWalletStore()
    const { connectWallet } = useWalletConnection()
    const { isWalletConnected, wallets } = useWallet()
    const { username } = useAuth()
    const [isBalanceHidden, setIsBalanceHidden] = useState(() => {
        const prefs = getUserPreferences()
        return prefs?.balanceHidden ?? false
    })

    const walletDetails = wallets.find((wallet) => wallet.address === focusedWallet)
    const isPeanutWallet = walletDetails?.walletProviderType === WalletProviderType.PEANUT
    const isConnected = isWalletConnected(walletDetails as IWallet)

    const handleToggleBalanceVisibility = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        setIsBalanceHidden((prev: boolean) => {
            const newValue = !prev
            updateUserPreferences({ balanceHidden: newValue })
            return newValue
        })
    }

    const renderTokenDetails = () => {
        if (!walletDetails) return null
        if (isPeanutWallet) {
            return walletDetails.balance && Number(walletDetails.balance) > 0 ? (
                <div className="space-y-3">
                    <div className="text-base font-semibold">Balance</div>
                    <div className="border border-b-n-1">
                        <ListItemView
                            key={`peanut-${walletDetails.address}`}
                            id={`${PEANUT_WALLET_CHAIN.id}-${PEANUT_WALLET_CHAIN.name}`}
                            variant="balance"
                            primaryInfo={{ title: PEANUT_WALLET_TOKEN_NAME }}
                            secondaryInfo={{
                                mainText: `$ ${formatAmount(formatUnits(walletDetails.balance, PEANUT_WALLET_TOKEN_DECIMALS))}`,
                                subText: PEANUT_WALLET_CHAIN.name,
                            }}
                            metadata={{
                                tokenLogo: ARBITRUM_ICON,
                                subText: `${formatAmount(formatUnits(walletDetails.balance, PEANUT_WALLET_TOKEN_DECIMALS))} USDC`,
                            }}
                        />
                    </div>
                </div>
            ) : (
                <NoDataEmptyState message="You don't have funds in your Peanut wallet" />
            )
        } else {
            return walletDetails.balances?.length ? (
                <div className="space-y-3 border-b border-b-n-1">
                    <div className="text-base font-semibold">Balance</div>
                    <div>
                        {walletDetails.balances.map((balance) => (
                            <ListItemView
                                key={`${balance.chainId}-${balance.symbol}`}
                                id={`${balance.chainId}-${balance.symbol}`}
                                variant="balance"
                                primaryInfo={{ title: balance.symbol }}
                                secondaryInfo={{
                                    mainText: `$ ${Number(balance.value).toFixed(2)}`,
                                    subText: getChainName(balance.chainId),
                                }}
                                metadata={{
                                    tokenLogo: balance.logoURI,
                                    subText: `${formatAmount(balance.amount)} ${balance.symbol}`,
                                }}
                                details={balance}
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <NoDataEmptyState message="No tokens found" />
            )
        }
    }

    return (
        <div className="mx-auto flex w-full flex-col gap-6 md:max-w-2xl">
            <div className="md:hidden">
                <NavHeader title={getHeaderTitle(pathname)} />
            </div>

            <div className="mx-auto">
                {focusedWallet && walletDetails && (
                    <WalletCard
                        key={walletDetails.address}
                        type="wallet"
                        wallet={walletDetails}
                        username={username ?? ''}
                        selected
                        onClick={() => {}}
                        index={0}
                        isFocused
                        isBalanceHidden={isBalanceHidden}
                        onToggleBalanceVisibility={handleToggleBalanceVisibility}
                    />
                )}
            </div>

            <DirectionalActionButtons
                leftButton={{ title: 'Top up', href: '/topup', disabled: true }}
                rightButton={{ title: 'Cashout', href: '/cashout' }}
            />

            {renderTokenDetails()}

            {!isPeanutWallet && (
                <Button
                    onClick={() => (isConnected ? disconnect() : connectWallet())}
                    variant="transparent-light"
                    className="flex w-full items-center justify-center gap-2 border border-black bg-purple-5 hover:bg-purple-5"
                >
                    <Icon name={isConnected ? 'minus-circle' : 'plus-circle'} fill="black" className="size-4" />
                    <div className="text-black">{isConnected ? 'Disconnect Wallet' : 'Connect Wallet'}</div>
                </Button>
            )}
        </div>
    )
}

export default WalletDetailsPage
