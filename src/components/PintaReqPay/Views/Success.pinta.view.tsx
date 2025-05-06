import { Button } from '@/components/0_Bruddle'
import Divider from '@/components/0_Bruddle/Divider'
import FlowHeader from '@/components/Global/FlowHeader'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAppDispatch, useWalletStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { walletActions } from '@/redux/slices/wallet-slice'
import { chargesApi } from '@/services/charges'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import PintaReqViewWrapper from '../PintaReqViewWrapper'

const PintaReqPaySuccessView = () => {
    const dispatch = useAppDispatch()
    const { rewardWalletBalance } = useWalletStore()
    const { getRewardWalletBalance } = useWallet()
    const [isPooling, setIsPolling] = useState(true)
    const remainingBeers = useMemo(() => Math.floor(Number(rewardWalletBalance)), [rewardWalletBalance])
    const searchParams = useSearchParams()
    const chargeId = searchParams.get('chargeId')

    // poll for payment status
    useEffect(() => {
        let intervalId: NodeJS.Timeout | undefined

        const pollStatus = async () => {
            if (!chargeId) return

            try {
                const updatedCharge = await chargesApi.get(chargeId)
                dispatch(paymentActions.setChargeDetails(updatedCharge))

                // stop polling if payment is in final state
                const finalStatus = updatedCharge.payments?.[0]?.status
                if (finalStatus === 'SUCCESSFUL' || finalStatus === 'FAILED') {
                    setIsPolling(false)
                    if (intervalId) {
                        clearInterval(intervalId)
                    }

                    // if successful, refetch the reward balance
                    if (finalStatus === 'SUCCESSFUL') {
                        const updatedBalance = await getRewardWalletBalance()
                        dispatch(walletActions.setRewardWalletBalance(updatedBalance))
                    }
                }
            } catch (error) {
                console.error('Failed to fetch status:', error)
                setIsPolling(false)
                if (intervalId) {
                    clearInterval(intervalId)
                }
            }
        }

        if (chargeId && isPooling) {
            pollStatus()
            intervalId = setInterval(pollStatus, 5000)
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId)
            }
        }
    }, [chargeId, dispatch, isPooling, getRewardWalletBalance])

    return (
        <div>
            <div className="space-y-4">
                <FlowHeader
                    onPrev={() => {
                        dispatch(paymentActions.setView('CONFIRM'))
                    }}
                />

                <PintaReqViewWrapper view="SUCCESS">
                    <div className="flex flex-col items-center justify-center gap-3 pt-2">
                        <div className="text-h8">You have</div>
                        <div className="space-y-2 text-center">
                            <div className="text-h5 font-bold">
                                {remainingBeers} {remainingBeers > 1 ? 'Beers' : 'Beer'}
                            </div>
                            <p className="text-xs font-semibold">remaining</p>
                        </div>
                    </div>
                    <Divider />
                    <Link href={'/home'} className="block">
                        <Button variant="purple">Back to home</Button>
                    </Link>
                </PintaReqViewWrapper>
            </div>
        </div>
    )
}

export default PintaReqPaySuccessView
