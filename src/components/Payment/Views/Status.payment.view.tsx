'use client'
import { Button } from '@/components/0_Bruddle'
import AddressLink from '@/components/Global/AddressLink'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { RecipientType } from '@/lib/url-parser/types/payment'
import { usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { ApiUser } from '@/services/users'
import { getInitialsFromName, printableAddress } from '@/utils'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { useDispatch } from 'react-redux'

interface DirectSendSuccessViewProps {
    user?: ApiUser
    amount?: string
    message?: string
    recipientType?: RecipientType
}

const PaymentStatusView = ({ user, amount, message, recipientType }: DirectSendSuccessViewProps = {}) => {
    const router = useRouter()
    const { chargeDetails, parsedPaymentData } = usePaymentStore()
    const dispatch = useDispatch()

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
        return amount || chargeDetails?.tokenAmount || '0'
    }, [amount, chargeDetails])

    const initials = getInitialsFromName(recipientName)

    const handleDone = () => {
        // reset payment state when done
        router.push('/home')
        dispatch(paymentActions.resetPaymentState())
    }

    return (
        <div className="flex flex-col gap-4">
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
                        <AvatarWithBadge className="bg-success-3" initials={initials} />
                    )}

                    <div className="space-y-1">
                        <h1 className="text-sm font-bold">
                            You just sent{' '}
                            {recipientType !== 'USERNAME' ? (
                                <AddressLink
                                    className="text-sm font-bold text-black no-underline"
                                    address={recipientName}
                                />
                            ) : (
                                recipientName
                            )}
                        </h1>
                        <h2 className="text-2xl font-extrabold">
                            {displayAmount} {chargeDetails?.tokenSymbol}
                        </h2>
                        {message && <p className="text-sm font-medium text-grey-1">for {message}</p>}
                    </div>
                </div>
            </Card>

            <Button onClick={handleDone} shadowSize="4" className="mx-auto w-38 rounded-full">
                <div className="flex size-7 items-center justify-center gap-0">
                    <Icon name="check" size={24} />
                </div>
                <div>Done!</div>
            </Button>
        </div>
    )
}
export default PaymentStatusView
