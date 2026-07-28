'use client'

/**
 * payment method action list for payment flows
 *
 * shows alternative payment methods (bank, mercadopago, pix)
 * for users who don't have peanut wallet balance.
 *
 * redirects to add-money flow after login/signup
 *
 * used by: send, semantic-request input views
 */

import { useRouter } from 'next/navigation'
import Divider from '@/components/0_Bruddle/Divider'
import { ActionListCard } from '@/components/ActionListCard'
import IconStack from '@/components/Global/IconStack'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { ACTION_METHODS, type PaymentMethod } from '@/constants/actionlist.consts'
import { useGeoFilteredPaymentOptions } from '@/hooks/useGeoFilteredPaymentOptions'
import Loading from '@/components/Global/Loading'
import { useCapabilities } from '@/hooks/useCapabilities'
import { saveRedirectUrl } from '@/utils/general.utils'
import { useTranslations } from 'next-intl'

interface PaymentMethodActionListProps {
    isAmountEntered: boolean
    showDivider?: boolean
    onPayWithExternalWallet?: () => void
}

/**
 * generic payment method action list for both direct send and semantic request flows
 * shows bank/mercadopago/pix options
 * redirects to setup with add-money as final destination after login/signup if user is not logged in
 * @param isAmountEntered - whether the amount is entered
 * @param showDivider - whether to show the divider
 * @returns the payment options list component
 */

export function PaymentMethodActionList({
    isAmountEntered,
    showDivider = true,
    onPayWithExternalWallet,
}: PaymentMethodActionListProps) {
    const router = useRouter()
    const t = useTranslations('payment')
    const tCommon = useTranslations('common')
    // Display-only "REQUIRES VERIFICATION" badges, provider-blind. The real
    // gate happens later in the add-money flow.
    //   QR-pay methods (mercadopago / pix) ← any rail with `pay` op enabled
    //   Bank methods                       ← any enabled bank rail
    const { canDo, bankRails } = useCapabilities()
    const isQrPayEnabled = canDo('pay')
    const isBankEnabled = bankRails().some((rail) => rail.status === 'enabled')

    // use geo filtering hook to sort methods based on user location
    // note: we don't mark verification-required methods as unavailable - they're still clickable
    const { filteredMethods: sortedMethods, isLoading: isGeoLoading } = useGeoFilteredPaymentOptions({
        sortUnavailable: true,
        isMethodUnavailable: (method) => method.soon,
        methods: ACTION_METHODS,
    })

    // The "Exchange or Wallet" card only does anything when the caller passes an
    // external-wallet handler (semantic-request flow). The direct-send flow has
    // no external-wallet path, so without this filter the card renders enabled
    // but its tap is a silent no-op — a dead button. Only offer it when we can
    // actually honor it.
    const visibleMethods = onPayWithExternalWallet
        ? sortedMethods
        : sortedMethods.filter((method) => method.id !== 'exchange-or-wallet')

    const handleMethodClick = (method: PaymentMethod) => {
        // for all methods, save current url and redirect to setup with add-money as final destination
        // verification will be handled in the add-money flow after login

        if (method.id === 'exchange-or-wallet' && onPayWithExternalWallet) {
            onPayWithExternalWallet()
            return
        }

        if (['bank', 'mercadopago', 'pix'].includes(method.id)) {
            saveRedirectUrl()
            const redirectUri = encodeURIComponent('/add-money')
            router.push(`/setup?redirect_uri=${redirectUri}`)
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
            {showDivider && <Divider text={tCommon('or')} />}
            <div className="space-y-2">
                {visibleMethods.map((method) => {
                    // does this method's gate require identity verification (badge display only)?
                    const qrMethodNeedsUnlock = ['mercadopago', 'pix'].includes(method.id) && !isQrPayEnabled
                    const bankMethodNeedsUnlock = method.id === 'bank' && !isBankEnabled
                    const methodRequiresVerification = qrMethodNeedsUnlock || bankMethodNeedsUnlock
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
                                            customText={methodRequiresVerification ? t('requiresVerification') : ''}
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
        </div>
    )
}
