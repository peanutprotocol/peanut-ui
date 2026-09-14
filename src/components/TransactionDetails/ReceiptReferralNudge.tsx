'use client'

import { useEffect, useRef } from 'react'
import posthog from 'posthog-js'
import { Icon } from '@/components/Global/Icons/Icon'
import ShareButton from '@/components/Global/ShareButton'
import { ANALYTICS_EVENTS, REFERRAL_SOURCES } from '@/constants/analytics.consts'

// One wire shape for all three legs of the referral nudge. Module-level so the
// impression effect can call it without re-running on every render.
const referralNudgeProps = (variant: 'button' | 'text_link') => ({
    source: REFERRAL_SOURCES.TRANSACTION_RECEIPT,
    link_type: 'invite_code',
    variant,
})

/**
 * Invite-friends CTA on completed receipts. With Split and Share Receipt both
 * stacked (a QR pay) the parent demotes it to an underlined text row so the
 * drawer never shows three equal-weight CTAs.
 */
export function ReceiptReferralNudge({
    transactionId,
    inviteLink,
    variant,
    label,
}: {
    transactionId: string
    inviteLink: string
    variant: 'button' | 'text_link'
    label: string
}) {
    // Outcome, not intent — ShareButton calls onSuccess only after a real share
    // or copy, so a cancelled share sheet captures nothing.
    const captureInviteShared = () => {
        const props = referralNudgeProps(variant)
        posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, props)
        posthog.capture(ANALYTICS_EVENTS.INVITE_LINK_SHARED, props)
    }

    // Per selected transaction, not per view: re-opening the same transaction
    // may not remount the drawer.
    const referralImpressionForId = useRef<string | null>(null)
    useEffect(() => {
        if (referralImpressionForId.current === transactionId) return
        referralImpressionForId.current = transactionId
        posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_SHOWN, referralNudgeProps(variant))
    }, [transactionId, variant])

    if (variant === 'button') {
        return (
            <ShareButton url={inviteLink} title="" variant="stroke" showIcon={false} onSuccess={captureInviteShared}>
                <Icon name="invite-heart" size={16} />
                <span className="text-body-s">{label}</span>
            </ShareButton>
        )
    }

    return (
        // Plain utilities beat the `.btn*` component classes (Tailwind emits
        // components before utilities), so no `!important` needed.
        <ShareButton
            url={inviteLink}
            title=""
            variant="transparent"
            showIcon={false}
            onSuccess={captureInviteShared}
            className="relative h-auto gap-2 p-0 text-body-s text-foreground-secondary underline shadow-none after:absolute after:inset-x-0 after:-inset-y-3.5 hover:text-foreground-primary active:translate-x-0 active:translate-y-0 active:text-foreground-primary"
        >
            <Icon name="invite-heart" size={16} className="text-foreground-secondary" />
            {label}
        </ShareButton>
    )
}
