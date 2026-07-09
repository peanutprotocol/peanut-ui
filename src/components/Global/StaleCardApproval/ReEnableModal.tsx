'use client'

import { useCallback, useEffect, useState } from 'react'
import ActionModal, { type ActionModalButtonProps } from '@/components/Global/ActionModal'
import { useGrantSessionKey } from '@/hooks/wallet/useGrantSessionKey'
import { RAIN_STALE_APPROVAL_EVENT } from '@/services/rain'

/**
 * Global recovery modal for the stale-card-approval case.
 *
 * When a card withdrawal is refused with 409 STALE_CARD_APPROVAL, the user's
 * stored session-key approval is bound to a deprecated validator that can no
 * longer be sponsored — so no funds can move until they re-enable the card.
 * `rainRequest` (services/rain.ts) dispatches `RAIN_STALE_APPROVAL_EVENT` on
 * that refusal; this modal listens globally (mounted once in ClientProviders)
 * so the recovery CTA surfaces on ANY spend path — withdraw, QR pay, send —
 * without threading state through each flow's catch block.
 *
 * The CTA reuses the existing session-key grant (`useGrantSessionKey().grant()`
 * — the same flow EnableAutoBalanceBanner drives) rather than building a new
 * one; a fresh grant re-binds a sponsorable approval and unblocks withdrawals.
 * Note: these users have `hasWithdrawApproval === true` (the approval exists,
 * it's just stale), so EnableAutoBalanceBanner never fires for them — this
 * modal is their only prompt.
 *
 * Unlike EnableAutoBalanceBanner this is NOT a hard block: the user can dismiss
 * and re-enable later. On a successful grant we show a short confirmation so
 * they know to retry the withdrawal.
 */
export default function StaleCardApprovalReEnableModal() {
    const { grant, isGranting } = useGrantSessionKey()
    const [visible, setVisible] = useState(false)
    const [succeeded, setSucceeded] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        const handler = () => {
            setSucceeded(false)
            setErrorMessage(null)
            setVisible(true)
        }
        window.addEventListener(RAIN_STALE_APPROVAL_EVENT, handler)
        return () => window.removeEventListener(RAIN_STALE_APPROVAL_EVENT, handler)
    }, [])

    const close = useCallback(() => setVisible(false), [])

    const onReEnable = useCallback(async () => {
        setErrorMessage(null)
        const result = await grant()
        if (result.ok) {
            setSucceeded(true)
        } else {
            setErrorMessage(
                result.error.kind === 'user-cancelled'
                    ? 'Re-enabling was cancelled. Tap Re-enable card to try again.'
                    : "We couldn't re-enable your card. Please try again."
            )
        }
    }, [grant])

    const ctas: ActionModalButtonProps[] = succeeded
        ? [{ text: 'Done', variant: 'purple', shadowSize: '4', onClick: close }]
        : [
              {
                  text: isGranting ? 'Working…' : 'Re-enable card',
                  variant: 'purple',
                  shadowSize: '4',
                  disabled: isGranting,
                  onClick: () => void onReEnable(),
              },
              { text: 'Not now', variant: 'stroke', disabled: isGranting, onClick: close },
          ]

    return (
        <ActionModal
            visible={visible}
            onClose={close}
            icon="credit-card"
            iconContainerClassName="bg-yellow-1"
            title={succeeded ? 'Card re-enabled' : 'Re-enable your card'}
            description={
                succeeded
                    ? 'Your card is ready — please try your withdrawal again.'
                    : (errorMessage ??
                      'Your card needs to be re-enabled before you can withdraw. It only takes one passkey tap.')
            }
            ctas={ctas}
        />
    )
}
