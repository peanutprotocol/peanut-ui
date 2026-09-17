'use client'

import { useEffect, useRef } from 'react'
import posthog from 'posthog-js'
import { useShareAction } from '@/components/Global/ShareButton/useShareAction'
import { useActivationStatus } from '@/hooks/useActivationStatus'
import { useAuth } from '@/context/authContext'
import { generateInviteCodeLink } from '@/utils/general.utils'
import { ANALYTICS_EVENTS, REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { hasReferralNudge } from './transaction-predicates'
import { type ReceiptMoreAction } from './ReceiptMoreActionsDrawer'
import { type TransactionDetails } from './transactionTransformer'

// one wire shape for the drawer row — same source/link_type the old surface
// ctas sent; `drawer_row` replaces the retired button/text_link variants
// (the nudge now has exactly one placement, TASK-22452)
const referralNudgeProps = {
    source: REFERRAL_SOURCES.TRANSACTION_RECEIPT,
    link_type: 'invite_code',
    variant: 'drawer_row',
}

/**
 * the invite-friends row for the receipt's More-actions drawer (TASK-22452:
 * KEEP, moved into the overflow). eligibility is the pre-#3159 gate
 * unchanged: the viewer's own completed outbound payment (hasReferralNudge),
 * an activated account with a username, never on the public receipt — a
 * bystander must not be credited for someone else's payment.
 *
 * the impression fires only while the drawer is OPEN with the row rendered,
 * once per transaction — reopening the drawer or re-rendering cannot double
 * it. outcome events stay outcome-based: they fire from the share hook's
 * onSuccess, so a cancelled share sheet captures nothing.
 */
export function useReceiptReferralAction(
    transaction: TransactionDetails,
    { isPublic, drawerOpen, onSelect }: { isPublic: boolean; drawerOpen: boolean; onSelect?: () => void }
): ReceiptMoreAction | null {
    const t = useAppTranslations('transaction')
    const { user } = useAuth()
    const { isActivated } = useActivationStatus()

    const inviteUsername = user?.user.username
    const eligible =
        !isPublic &&
        isActivated &&
        transaction.status === 'completed' &&
        hasReferralNudge(transaction) &&
        !!inviteUsername
    const inviteLink = inviteUsername ? generateInviteCodeLink(inviteUsername).inviteLink : ''

    const share = useShareAction({
        url: inviteLink,
        onSuccess: () => {
            posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, referralNudgeProps)
            posthog.capture(ANALYTICS_EVENTS.INVITE_LINK_SHARED, referralNudgeProps)
        },
    })

    // per transaction, not per open: the details drawer swaps transactions
    // without remounting, and reopening the same receipt must not re-fire
    const impressionForId = useRef<string | null>(null)
    useEffect(() => {
        if (!drawerOpen || !eligible) return
        if (impressionForId.current === transaction.id) return
        impressionForId.current = transaction.id
        posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_SHOWN, referralNudgeProps)
    }, [drawerOpen, eligible, transaction.id])

    if (!eligible) return null

    return {
        icon: 'invite-heart',
        title: t('actions.inviteFriends'),
        onSelect: () => {
            onSelect?.()
            void share()
        },
        'data-testid': 'more-action-invite',
    }
}
