'use client'

/**
 * payment options for request pot flow
 *
 * shows payment methods for contributing to a request pot:
 * - pay with peanut (primary, uses wallet balance)
 * - bank/mercadopago/pix (redirects to add-money)
 *
 * includes smart "use your peanut balance" modal - if user has
 * enough balance but clicks on bank, suggests using peanut instead
 *
 * validates minimum amounts for bank transfers
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Divider from '@/components/0_Bruddle/Divider'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import IconStack from '@/components/Global/IconStack'
import Loading from '@/components/Global/Loading'
import ActionModal from '@/components/Global/ActionModal'
import { ActionListCard } from '@/components/ActionListCard'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useGeoFilteredPaymentOptions } from '@/hooks/useGeoFilteredPaymentOptions'
import useKycStatus from '@/hooks/useKycStatus'
import { BankRequestType, useDetermineBankRequestType } from '@/hooks/useDetermineBankRequestType'
import { ACTION_METHODS, type PaymentMethod } from '@/constants/actionlist.consts'
import { MIN_BANK_TRANSFER_AMOUNT, validateMinimumAmount } from '@/constants/payment.consts'
import { saveRedirectUrl, saveToLocalStorage } from '@/utils/general.utils'
import SendWithPeanutCta from '@/features/payments/shared/components/SendWithPeanutCta'

interface RequestPotActionListProps {
    isAmountEntered: boolean
    usdAmount: string
    recipientUserId?: string
    onPayWithPeanut: () => void
    isPaymentLoading?: boolean
    onPayWithExternalWallet: () => void
}

export function RequestPotActionList({
    isAmountEntered,
    usdAmount,
    recipientUserId,
    onPayWithPeanut,
    isPaymentLoading = false,
    onPayWithExternalWallet,
}: RequestPotActionListProps) {
    const router = useRouter()
    const { user } = useAuth()
    const { hasSufficientBalance, isFetchingBalance } = useWallet()
    const { isUserMantecaKycApproved } = useKycStatus()
    const { requestType } = useDetermineBankRequestType(recipientUserId ?? '')

    const [showMinAmountError, setShowMinAmountError] = useState(false)
    const [showUsePeanutBalanceModal, setShowUsePeanutBalanceModal] = useState(false)
    const [isUsePeanutBalanceModalShown, setIsUsePeanutBalanceModalShown] = useState(false)
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null)

    const isLoggedIn = !!user?.user?.userId

    // check if verification is required for bank
    const requiresVerification = useMemo(() => {
        return requestType === BankRequestType.GuestKycNeeded || requestType === BankRequestType.PayerKycNeeded
    }, [requestType])

    // check if user has enough peanut balance for the entered amount
    // only show insufficient balance after balance has loaded to avoid flash
    const userHasSufficientPeanutBalance = useMemo(() => {
        if (!user || !usdAmount) return false
        if (isFetchingBalance) return true // assume sufficient while loading to avoid flash
        return hasSufficientBalance(usdAmount)
    }, [user, usdAmount, hasSufficientBalance, isFetchingBalance])

    // filter and sort payment methods
    const { filteredMethods: sortedMethods, isLoading: isGeoLoading } = useGeoFilteredPaymentOptions({
        sortUnavailable: true,
        isMethodUnavailable: (method) =>
            method.soon ||
            (method.id === 'bank' && requiresVerification) ||
            (['mercadopago', 'pix'].includes(method.id) && !isUserMantecaKycApproved),
        methods: ACTION_METHODS,
    })

    // handle clicking on a payment method
    const handleMethodClick = (method: PaymentMethod, bypassBalanceModal = false) => {
        const requestAmountValue = parseFloat(usdAmount || '0')

        // validate minimum amount for bank/mercadopago/pix against user-entered amount
        if (
            ['bank', 'mercadopago', 'pix'].includes(method.id) &&
            !validateMinimumAmount(requestAmountValue, method.id)
        ) {
            setShowMinAmountError(true)
            return
        }

        // if user has sufficient peanut balance and hasn't dismissed the modal, suggest using peanut
        if (!bypassBalanceModal && !isUsePeanutBalanceModalShown && userHasSufficientPeanutBalance) {
            setSelectedPaymentMethod(method)
            setShowUsePeanutBalanceModal(true)
            return
        }

        if (method.id === 'exchange-or-wallet') {
            onPayWithExternalWallet()
            return
        }

        // redirect to add-money flow for bank/mercadopago/pix
        switch (method.id) {
            case 'bank':
            case 'mercadopago':
            case 'pix':
                if (isLoggedIn) {
                    // save current url so back button works properly
                    saveRedirectUrl()
                    // flag that we're coming from request fulfillment
                    saveToLocalStorage('fromRequestFulfillment', 'true')
                    router.push('/add-money')
                } else {
                    const redirectUri = encodeURIComponent('/add-money')
                    router.push(`/setup?redirect_uri=${redirectUri}`)
                }
                break
        }
    }

    // handle continue with peanut (for non-logged in users)
    const handleContinueWithPeanut = () => {
        if (!isLoggedIn) {
            saveRedirectUrl()
            router.push('/setup')
        } else {
            onPayWithPeanut()
        }
    }

    if (isGeoLoading) {
        return (
            <div className="flex w-full items-center justify-center py-8">
                <Loading />
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {/* pay with peanut button */}
            <SendWithPeanutCta
                onClick={handleContinueWithPeanut}
                disabled={!isAmountEntered || isPaymentLoading}
                loading={isPaymentLoading}
                insufficientBalance={!userHasSufficientPeanutBalance}
            />

            <Divider text="or" />

            {/* payment methods */}
            <div className="space-y-2">
                {sortedMethods.map((method) => {
                    let methodRequiresVerification = method.id === 'bank' && requiresVerification
                    if (!isUserMantecaKycApproved && ['mercadopago', 'pix'].includes(method.id)) {
                        methodRequiresVerification = true
                    }

                    return (
                        <ActionListCard
                            key={method.id}
                            position="single"
                            description={method.description}
                            descriptionClassName="text-[12px]"
                            title={
                                <div className="flex items-center gap-2">
                                    {method.title}
                                    {(method.soon || methodRequiresVerification) && (
                                        <StatusBadge
                                            status={methodRequiresVerification ? 'custom' : 'soon'}
                                            customText={methodRequiresVerification ? 'REQUIRES VERIFICATION' : ''}
                                        />
                                    )}
                                </div>
                            }
                            onClick={() => handleMethodClick(method)}
                            isDisabled={method.soon || !isAmountEntered}
                            rightContent={<IconStack icons={method.icons} iconSize={method.id === 'bank' ? 80 : 24} />}
                        />
                    )
                })}
            </div>

            {/* minimum amount error modal */}
            <ActionModal
                visible={showMinAmountError}
                onClose={() => setShowMinAmountError(false)}
                title="Minimum Amount"
                description={`The minimum amount for this payment method is $${MIN_BANK_TRANSFER_AMOUNT}. Please enter a higher amount or try a different method.`}
                icon="alert"
                ctas={[{ text: 'Close', shadowSize: '4', onClick: () => setShowMinAmountError(false) }]}
                iconContainerClassName="bg-yellow-400"
                preventClose={false}
                modalPanelClassName="max-w-md mx-8"
            />

            {/* use peanut balance modal - only shown when user has enough balance */}
            <ActionModal
                visible={showUsePeanutBalanceModal}
                onClose={() => {
                    setShowUsePeanutBalanceModal(false)
                    setIsUsePeanutBalanceModalShown(true)
                    setSelectedPaymentMethod(null)
                }}
                title="Use your Peanut balance instead"
                description="You already have enough funds in your Peanut account. Using this method is instant and avoids delays."
                icon="user-plus"
                ctas={[
                    {
                        text: 'Pay with Peanut',
                        shadowSize: '4',
                        onClick: () => {
                            setShowUsePeanutBalanceModal(false)
                            setIsUsePeanutBalanceModalShown(true)
                            setSelectedPaymentMethod(null)
                            onPayWithPeanut()
                        },
                    },
                    {
                        text: 'Continue',
                        shadowSize: '4',
                        variant: 'stroke',
                        onClick: () => {
                            setShowUsePeanutBalanceModal(false)
                            setIsUsePeanutBalanceModalShown(true)
                            if (selectedPaymentMethod) {
                                handleMethodClick(selectedPaymentMethod, true)
                            }
                            setSelectedPaymentMethod(null)
                        },
                    },
                ]}
                iconContainerClassName="bg-primary-1"
                preventClose={false}
                modalPanelClassName="max-w-md mx-8"
            />
        </div>
    )
}
