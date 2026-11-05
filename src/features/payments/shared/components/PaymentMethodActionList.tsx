'use client'

/**
 * payment method action list for payment flows
 *
 * shows the funding methods a guest can use to pay (bank, mercadopago, pix),
 * each of which goes through login/signup to the add-money flow, and the
 * external-wallet method when the caller can honor it.
 *
 * a signed-in user gets none of them: they pay from their Peanut balance. The
 * guest methods would send them to /setup, which they have already completed,
 * and an external wallet is not how a Peanut user pays.
 *
 * used by: send, semantic-request input views
 */

import { useRouter } from 'next/navigation'
import Divider from '@/components/0_Bruddle/Divider'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import IconStack from '@/components/Global/IconStack'
import Badge from '@/components/Global/Badges/Badge'
import { ACTION_METHODS, type PaymentMethod } from '@/constants/actionlist.consts'
import { usePaymentMethodLabels } from '@/features/payments/shared/hooks/usePaymentMethodLabels'
import { useGeoFilteredPaymentOptions } from '@/hooks/useGeoFilteredPaymentOptions'
import Loading from '@/components/Global/Loading'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useAuth } from '@/context/authContext'
import { saveRedirectUrl } from '@/utils/general.utils'
import { useTranslations } from 'next-intl'

// methods that fund through login/signup and the add-money flow
const GUEST_METHOD_IDS = ['bank', 'mercadopago', 'pix']

interface PaymentMethodActionListProps {
    isAmountEntered: boolean
    showDivider?: boolean
    onPayWithExternalWallet?: () => void
}

/**
 * generic payment method action list for both direct send and semantic request flows
 * shows bank/mercadopago/pix options to guests only, who redirect to setup with
 * add-money as the final destination after login/signup; renders nothing for a
 * signed-in user
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
    const methodLabels = usePaymentMethodLabels()
    const { user, isFetchingUser } = useAuth()
    const isLoggedIn = !!user?.user?.userId
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

        if (GUEST_METHOD_IDS.includes(method.id)) {
            saveRedirectUrl()
            const redirectUri = encodeURIComponent('/add-money')
            router.push(`/setup?redirect_uri=${redirectUri}`)
        }
    }

    // The list is for guests. A signed-in user pays from their Peanut balance:
    // the guest methods fund through signup (/setup), which they have already
    // completed, and an external wallet is not how a Peanut user pays. Hidden
    // while the session resolves too, so it never flashes for that user.
    if (isLoggedIn || isFetchingUser) return null

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
                        <ListItem
                            key={method.id}
                            position="solo"
                            body={<div className="text-body-xs">{methodLabels(method).description}</div>}
                            title={
                                <div className="flex items-center gap-2">
                                    {methodLabels(method).title}
                                    {(method.soon || methodRequiresVerification) && (
                                        <Badge
                                            status={methodRequiresVerification ? 'pending' : 'soon'}
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
            </div>
        </div>
    )
}
