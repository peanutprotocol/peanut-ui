import { ARBITRUM_ICON } from '@/assets'
import { Card } from '@/components/0_Bruddle'
import { useWallet } from '@/hooks/wallet/useWallet'
import { printableUsdc } from '@/utils'
import Image from 'next/image'
import { useMemo } from 'react'
import { parseUnits } from 'viem'

const ProfileWalletBalance = () => {
    const { selectedWallet } = useWallet()

    const getMaxBalanceToken = useMemo(() => {
        if (!selectedWallet || !selectedWallet.balances || selectedWallet.balances.length === 0) return null

        return selectedWallet.balances.reduce((max, current) => {
            return current.value > max.value ? current : max
        }, selectedWallet.balances[0])
    }, [selectedWallet])

    return (
        <div className="space-y-4">
            <div>My Peanut wallet</div>
            <Card>
                <Card.Content className="flex items-center justify-between border-b-0 px-5 py-4">
                    <div className="flex items-center gap-3">
                        {/* todo: figure out a way to get chain image dynamically here */}
                        <div className="relative">
                            <Image
                                src={
                                    getMaxBalanceToken?.logoURI ||
                                    'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=040'
                                }
                                alt="token logo"
                                width={30}
                                height={30}
                                className="rounded-full"
                            />
                            <Image
                                src={ARBITRUM_ICON}
                                alt="token logo"
                                width={16}
                                height={16}
                                className="absolute -right-2 bottom-0 size-4 rounded-full"
                            />
                        </div>
                        <div className="text-lg font-bold">{getMaxBalanceToken?.symbol || 'USDC'}</div>
                    </div>
                    <div>
                        <div className="text-right text-sm font-bold text-black">
                            ${printableUsdc(parseUnits(getMaxBalanceToken?.value || '0', 6))}
                        </div>
                        {getMaxBalanceToken?.symbol && getMaxBalanceToken?.name && (
                            <div className="text-xs text-grey-1">
                                {getMaxBalanceToken?.symbol} on {getMaxBalanceToken?.name}
                            </div>
                        )}
                    </div>
                </Card.Content>
            </Card>
        </div>
    )
}

export default ProfileWalletBalance
