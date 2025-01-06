import { Card } from '@/components/0_Bruddle'
import { useWallet } from '@/context/walletContext'
import { printableUsdc } from '@/utils'
import Image from 'next/image'
import { useMemo } from 'react'

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
                        {/* todo: figure out a way to get chain image here */}
                        <Image
                            src={getMaxBalanceToken?.logoURI as string}
                            alt="token logo"
                            width={30}
                            height={30}
                            className="rounded-full"
                        />
                        <div className="text-lg font-bold">{getMaxBalanceToken?.symbol}</div>
                    </div>
                    <div>
                        <div className="text-right text-sm font-bold text-black">
                            $ {printableUsdc(BigInt(Math.floor(Number(getMaxBalanceToken?.value || 0) * 10 ** 6)))}
                        </div>
                        <div className="text-xs text-gray-1">
                            {getMaxBalanceToken?.symbol} on {getMaxBalanceToken?.name}
                        </div>
                    </div>
                </Card.Content>
            </Card>
        </div>
    )
}

export default ProfileWalletBalance
