'use client'

import { Button } from '@/components/0_Bruddle'
import DirectionalActionButtons from '@/components/Global/DirectionalActionButtons'
import NoDataEmptyState from '@/components/Global/EmptyStates/NoDataEmptyState'
import Icon from '@/components/Global/Icon'
import { ListItemView } from '@/components/Global/ListItemView'
import NavHeader from '@/components/Global/NavHeader'
import { WalletCard } from '@/components/Home/WalletCard'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { IUserBalance, WalletProviderType } from '@/interfaces'
import { formatAmount, getChainName, getUserPreferences, updateUserPreferences } from '@/utils'
import { useAppKit, useDisconnect } from '@reown/appkit/react'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

const WalletDetailsPage = () => {
    const { selectedWallet, isConnected } = useWallet()
    const { open } = useAppKit()
    const { disconnect } = useDisconnect()
    const [isBalanceHidden, setIsBalanceHidden] = useState(() => {
        const prefs = getUserPreferences()
        return prefs?.balanceHidden ?? false
    })

    const { username } = useAuth()
    const isActiveWalletPW = selectedWallet?.walletProviderType === WalletProviderType.PEANUT
    const isActiveWalletBYOW = selectedWallet?.walletProviderType === WalletProviderType.BYOW

    console.log('selectedWallet', selectedWallet)

    const handleToggleBalanceVisibility = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        setIsBalanceHidden((prev: boolean) => {
            const newValue = !prev
            updateUserPreferences({ balanceHidden: newValue })
            return newValue
        })
    }

    return (
        <div className="mx-auto flex w-full flex-col gap-6 md:max-w-2xl">
            <div className="md:hidden">
                <NavHeader title="Wallet asset" />
            </div>

            <div className="mx-auto">
                {selectedWallet && (
                    <WalletCard
                        key={selectedWallet.address}
                        type="wallet"
                        wallet={selectedWallet}
                        username={username ?? ''}
                        selected
                        onClick={() => {}}
                        index={0}
                        isBalanceHidden={isBalanceHidden}
                        onToggleBalanceVisibility={handleToggleBalanceVisibility}
                    />
                )}
            </div>

            <DirectionalActionButtons
                leftButton={{
                    title: 'Top up',
                    href: '/topup',
                    disabled: true,
                }}
                rightButton={{
                    title: 'Cash out',
                    href: '/cashout',
                }}
            />

            <div
                className={twMerge(
                    selectedWallet?.balances && !!selectedWallet?.balances?.length ? 'border-b border-b-n-1' : ''
                )}
            >
                {!!selectedWallet?.balances?.length ? (
                    <div className="space-y-3">
                        <div className="text-base font-semibold">Balance</div>
                        <div>
                            {selectedWallet.balances.map((balance: IUserBalance) => (
                                <ListItemView
                                    key={`${balance.chainId}-${balance.symbol}`}
                                    id={`${balance.chainId}-${balance.symbol}`}
                                    variant="balance"
                                    primaryInfo={{
                                        title: balance.symbol,
                                    }}
                                    secondaryInfo={{
                                        mainText: `$${Number(balance.value).toFixed(2)}`,
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
                )}
            </div>
            <div>
                <Button
                    onClick={() => {
                        if (isConnected) {
                            disconnect()
                        } else {
                            open()
                        }
                    }}
                    variant="stroke"
                    className="flex w-full items-center justify-center gap-2 bg-purple-4/30 hover:bg-purple-4/20"
                >
                    <Icon name={isConnected ? 'minus-circle' : 'plus-circle'} className="size-4" />
                    <div>{isConnected ? 'Disconnect' : 'Connect'}</div>
                </Button>
            </div>
        </div>
    )
}

export default WalletDetailsPage
