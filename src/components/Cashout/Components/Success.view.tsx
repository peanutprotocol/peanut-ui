'use client'
import Icon from '@/components/Global/Icon'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import * as _consts from '../Cashout.consts'
import { useSubscription } from '@web3inbox/react'
import { useAccount } from 'wagmi'
import ConfirmCashoutDetails from './ConfirmCashoutDetails'

export const CashoutSuccessView = ({ recipient, usdValue }: _consts.ICashoutScreenProps) => {
    const { address } = useAccount({})
    const { data: subscription } = useSubscription()
    const isSubscribed = Boolean(subscription)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (isSubscribed && isLoading) {
            setIsLoading(false)
        }
    }, [isSubscribed, address])

    return (
        <div
            className={`mx-auto flex w-full max-w-[96%] flex-col items-center justify-center gap-6 py-2 pb-20 text-center`}
        >
            <div className="flex flex-col items-center justify-center gap-1">
                <label className="text-h4">Your funds are on the way!</label>
                <label className="text-h8">Cashing out usually takes 20 minutes but can take up to two days.</label>
                <label className="text-h8">You will receive an email confirmation.</label>
                <label className="text-h8">A confirmation email will be sent to konrad@peanut.to</label>
            </div>

            <div className="flex w-full flex-col items-center justify-start gap-2 border border-black p-4">
                <ConfirmCashoutDetails tokenAmount={usdValue as string} />
                <label className="max-w-96 text-center text-h6 font-light">Konrad Urban</label>
                <label className="max-w-96 text-center text-h6 font-light">konrad@peanut.to</label>
                <label className="max-w-96 text-center text-h6 font-light">{recipient.address}</label>
            </div>

            <Link
                className="absolute bottom-0 flex h-20 w-[27rem] w-full flex-row items-center justify-center gap-2 border-t-[1px] border-black bg-purple-3  px-4.5 dark:text-black"
                href={'/profile'}
            >
                Go to Dashboard
            </Link>
        </div>
    )
}
