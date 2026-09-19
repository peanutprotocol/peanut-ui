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
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useGeoFilteredPaymentOptions } from '@/hooks/useGeoFilteredPaymentOptions'
import { useCapabilities } from '@/hooks/useCapabilities'
import { BankRequestType, useDetermineBankRequestType } from '@/hooks/useDetermineBankRequestType'
import { ACTION_METHODS, type PaymentMethod } from '@/constants/actionlist.consts'
import { MIN_BANK_TRANSFER_AMOUNT, validateMinimumAmount } from '@/constants/payment.consts'
import { EInviteType } from '@/services/services.types'
import { saveRedirectUrl, saveToLocalStorage, toInviteCode, inviteFlowUrl } from '@/utils/general.utils'
import SendWithPeanutCta from '@/features/payments/shared/components/SendWithPeanutCta'
import { PayByBankTransferDrawer } from './PayByBankTransferDrawer'
import { isUsdPeggedRequest } from '@/features/deposit-accounts/payerAmount'
import { useTranslations } from 'next-intl'
import { stashInvite } from '@/utils/invite-stash'

interface RequestPotActionListProps {
    isAmountEntered: boolean
    usdAmount: string
    recipientUserId?: string
    recipientUsername?: string
    /** the request being paid — needed to read its bank details */
    requestId?: string
    /** the requester lets this request be settled by bank transfer */
    bankPayable?: boolean
    /** what the request still needs, in dollars; undefined on an open-amount request */
    remainingUsd?: number
    /** the token the request is denominated in; a bank payer is shown an amount only when it is a dollar token */
    requestTokenSymbol?: string | null
    onPayWithPeanut: () => void
    isPaymentLoading?: boolean
    isExternalWalletLoading?: boolean
    onPayWithExternalWallet: () => void
}

export function RequestPotActionList({
    isAmountEntered,
    usdAmount,
    recipientUserId,
    recipientUsername,
    requestId,
    bankPayable = false,
    remainingUsd,
    requestTokenSymbol,
    onPayWithPeanut,
    isPaymentLoading = false,
    isExternalWalletLoading = false,
    onPayWithExternalWallet,
}: RequestPotActionListProps) {
    const router = useRouter()
    const t = useTranslations('payment')
    const tCommon = useTranslations('common')
    const { user, isFetchingUser } = useAuth()
    const { hasSufficientSpendableBalance: hasSufficientBalance, isFetchingSpendableBalance } = useWallet()
    // MIGRATION-REVIEW: mercadopago/pix are QR `pay` methods over Manteca. Old gate was
    // `isUserMantecaKycApproved`; mapped to canDo('pay', { provider: 'manteca' }) (operation-specific).
    const isMantecaPayEnabled = useCapabilities().canDo('pay', { provider: 'manteca' })
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
        // wait on BOTH smart + Rain overview (spendable) — using the smart-only
        // flag would gate on a partial balance and flash a false "insufficient"
        // for split-funds users during the Rain-overview load window.
        if (isFetchingSpendableBalance) return true // assume sufficient while loading to avoid flash
        return hasSufficientBalance(usdAmount)
    }, [user, usdAmount, hasSufficientBalance, isFetchingSpendableBalance])

    // filter and sort payment methods
    const { filteredMethods: sortedMethods, isLoading: isGeoLoading } = useGeoFilteredPaymentOptions({
        sortUnavailable: true,
        isMethodUnavailable: (method) =>
            method.soon ||
            (method.id === 'bank' && requiresVerification) ||
            (['mercadopago', 'pix'].includes(method.id) && !isMantecaPayEnabled),
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
                    if (recipientUsername) {
                        const inviteCode = toInviteCode(recipientUsername)
                        stashInvite(inviteCode, EInviteType.PAYMENT_LINK)
                        router.push(inviteFlowUrl(inviteCode, redirectUri))
                    } else {
                        router.push(`/setup?redirect_uri=${redirectUri}`)
                    }
                }
                break
        }
    }

    // A signed-out payer who taps the generic "Bank" method is sent to signup,
    // because that method funds a Peanut balance first. When the requester
    // shares bank details, a signed-out payer — a business paying an invoice,
    // say — can pay with no account, so that row leads and the generic one goes.
    // A signed-in payer keeps both: the transfer asks them to leave the app and
    // type a reference, so it stays the last option.
    const requesterBankFirst = bankPayable && !!requestId && !isLoggedIn && !isFetchingUser
    const visibleMethods = requesterBankFirst ? sortedMethods.filter((method) => method.id !== 'bank') : sortedMethods
    const isDollarRequest = isUsdPeggedRequest(requestTokenSymbol)
    const requesterBankRow = requestId ? (
        <PayByBankTransferDrawer
            requestId={requestId}
            bankPayable={bankPayable}
            usdAmount={isDollarRequest ? usdAmount : undefined}
            remainingUsd={isDollarRequest ? remainingUsd : undefined}
        />
    ) : null

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
                onClick={onPayWithPeanut}
                disabled={!isAmountEntered || isPaymentLoading || isExternalWalletLoading}
                loading={isPaymentLoading}
                insufficientBalance={!userHasSufficientPeanutBalance}
                inviterUsername={recipientUsername}
            />

            <Divider text={tCommon('or')} />

            {/* payment methods */}
            <div className="space-y-2">
                {requesterBankFirst && requesterBankRow}
                {visibleMethods.map((method) => {
                    let methodRequiresVerification = method.id === 'bank' && requiresVerification
                    if (!isMantecaPayEnabled && ['mercadopago', 'pix'].includes(method.id)) {
                        methodRequiresVerification = true
                    }

                    return (
                        <ListItem
                            key={method.id}
                            position="single"
                            body={<div className="text-body-xs">{method.description}</div>}
                            title={
                                <div className="flex items-center gap-2">
                                    {method.title}
                                    {(method.soon || methodRequiresVerification) && (
                                        <StatusBadge
                                            status={methodRequiresVerification ? 'custom' : 'soon'}
                                            customText={methodRequiresVerification ? t('requiresVerification') : ''}
                                        />
                                    )}
                                </div>
                            }
                            onClick={() => handleMethodClick(method)}
                            disabled={method.soon || !isAmountEntered}
                            trailing={<IconStack icons={method.icons} iconSize={24} />}
                        />
                    )
                })}

                {!requesterBankFirst && requesterBankRow}
            </div>

            {/* minimum amount error modal */}
            <ActionModal
                visible={showMinAmountError}
                onClose={() => setShowMinAmountError(false)}
                title={t('minAmount.title')}
                description={t('minAmount.description', { minAmount: MIN_BANK_TRANSFER_AMOUNT })}
                tone="warning"
                ctas={[{ text: tCommon('close'), shadowSize: '4', onClick: () => setShowMinAmountError(false) }]}
                preventClose={false}
            />

            {/* use peanut balance modal - only shown when user has enough balance */}
            <ActionModal
                visible={showUsePeanutBalanceModal}
                onClose={() => {
                    setShowUsePeanutBalanceModal(false)
                    setIsUsePeanutBalanceModalShown(true)
                    setSelectedPaymentMethod(null)
                }}
                title={t('usePeanutBalance.title')}
                description={t('usePeanutBalance.description')}
                icon="user-plus"
                ctas={[
                    {
                        text: t('usePeanutBalance.payWithPeanut'),
                        shadowSize: '4',
                        onClick: () => {
                            setShowUsePeanutBalanceModal(false)
                            setIsUsePeanutBalanceModalShown(true)
                            setSelectedPaymentMethod(null)
                            onPayWithPeanut()
                        },
                    },
                    {
                        text: tCommon('continue'),
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
                preventClose={false}
            />
        </div>
    )
}
