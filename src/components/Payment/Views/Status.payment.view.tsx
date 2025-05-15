'use client'
import { Button } from '@/components/0_Bruddle'
import AddressLink from '@/components/Global/AddressLink'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import Loading from '@/components/Global/Loading'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { TRANSACTIONS } from '@/constants/query.consts'
import { RecipientType } from '@/lib/url-parser/types/payment'
import { usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { ApiUser } from '@/services/users'
import { printableAddress } from '@/utils'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'

type DirectSuccessViewProps = {
    user?: ApiUser
    amount?: string
    message?: string
    recipientType?: RecipientType
    type: 'SEND' | 'REQUEST'
    headerTitle?: string
    currencyAmount?: string
}

const DirectSuccessView = ({
    user,
    amount,
    message,
    recipientType,
    type,
    headerTitle,
    currencyAmount,
}: DirectSuccessViewProps) => {
    const router = useRouter()
    const { chargeDetails, parsedPaymentData } = usePaymentStore()
    const [showCheck, setShowCheck] = useState(false)
    const dispatch = useDispatch()
    const queryClient = useQueryClient()

    const recipientName = useMemo(() => {
        if (user?.username) {
            return user.fullName || user.username
        }
        if (parsedPaymentData?.recipient?.identifier) {
            return parsedPaymentData.recipient.identifier
        }
        return printableAddress(chargeDetails?.requestLink?.recipientAddress || '')
    }, [user, parsedPaymentData, chargeDetails])

    const displayAmount = useMemo(() => {
        if (currencyAmount) return currencyAmount
        const displayAmount = amount ?? chargeDetails?.tokenAmount ?? '0'
        return `${displayAmount} ${chargeDetails?.tokenSymbol ?? 'USDC'}`
    }, [amount, chargeDetails, currencyAmount])

    useEffect(() => {
        // show loading for a brief moment, then show check mark
        const checkTimeout = setTimeout(() => {
            setShowCheck(true)
        }, 800)

        // Invalidate queries to refetch history
        queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })

        // redirect to home after 2 seconds
        const redirectTimeout = setTimeout(() => {
            router.push('/home')
        }, 2000)

        return () => {
            clearTimeout(checkTimeout)
            clearTimeout(redirectTimeout)
        }
    }, [router, queryClient])

    const handleDone = () => {
        // reset payment state when done
        router.push('/home')
        dispatch(paymentActions.resetPaymentState())
        queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
    }

    return (
        <div>
            <div className="translate-y-2/3 space-y-4">
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        {recipientType !== 'USERNAME' ? (
                            <div
                                className={
                                    'flex h-16 w-16 min-w-16 items-center justify-center rounded-full bg-yellow-5 font-bold'
                                }
                            >
                                <Icon name="wallet-outline" size={24} />
                            </div>
                        ) : (
                            <AvatarWithBadge name={recipientName} />
                        )}
                    </div>

                    <div className="space-y-1">
                        <h1 className="text-sm font-bold">
                            You just {type === 'SEND' ? 'sent' : 'requested'}{' '}
                            {recipientType !== 'USERNAME' ? (
                                <AddressLink
                                    className="text-sm font-bold text-black no-underline"
                                    address={recipientName}
                                />
                            ) : (
                                recipientName
                            )}
                        </h1>
                        <h2 className="text-2xl font-extrabold">{displayAmount}</h2>
                        {message && <p className="text-sm font-medium text-grey-1">for {message}</p>}
                    </div>
                </Card>

                <Button onClick={handleDone} shadowSize="4" className="mx-auto w-38 rounded-full">
                    <div className="flex size-7 items-center justify-center gap-0">
                        {showCheck ? <Icon name="check" size={24} /> : <Loading />}
                    </div>
                    <div>Done!</div>
                </Button>
            </div>
        </div>
    )
}
export default DirectSuccessView
