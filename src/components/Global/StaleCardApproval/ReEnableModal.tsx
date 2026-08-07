'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import ActionModal, { type ActionModalButtonProps } from '@/components/Global/ActionModal'
import { useGrantSessionKey } from '@/hooks/wallet/useGrantSessionKey'
import { RAIN_STALE_APPROVAL_EVENT } from '@/services/rain'

type GrantErrorKind = 'user-cancelled' | 'unexpected'

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
    const t = useTranslations('global')
    const { grant, isGranting } = useGrantSessionKey()
    const [visible, setVisible] = useState(false)
    const [succeeded, setSucceeded] = useState(false)
    const [errorKind, setErrorKind] = useState<GrantErrorKind | null>(null)

    useEffect(() => {
        const handler = () => {
            setSucceeded(false)
            setErrorKind(null)
            setVisible(true)
        }
        window.addEventListener(RAIN_STALE_APPROVAL_EVENT, handler)
        return () => window.removeEventListener(RAIN_STALE_APPROVAL_EVENT, handler)
    }, [])

    const close = useCallback(() => setVisible(false), [])

    const onReEnable = useCallback(async () => {
        setErrorKind(null)
        const result = await grant()
        if (result.ok) {
            setSucceeded(true)
        } else {
            setErrorKind(result.error.kind === 'user-cancelled' ? 'user-cancelled' : 'unexpected')
        }
    }, [grant])

    const errorMessage =
        errorKind === 'user-cancelled'
            ? t('staleCardApprovalModal.cancelledError')
            : errorKind === 'unexpected'
              ? t('staleCardApprovalModal.unexpectedError')
              : null

    const ctas: ActionModalButtonProps[] = succeeded
        ? [{ text: t('staleCardApprovalModal.doneCta'), variant: 'purple', shadowSize: '4', onClick: close }]
        : [
              {
                  text: isGranting ? t('staleCardApprovalModal.workingCta') : t('staleCardApprovalModal.reEnableCta'),
                  variant: 'purple',
                  shadowSize: '4',
                  disabled: isGranting,
                  onClick: () => void onReEnable(),
              },
              {
                  text: t('staleCardApprovalModal.notNowCta'),
                  variant: 'stroke',
                  disabled: isGranting,
                  onClick: close,
              },
          ]

    return (
        <ActionModal
            visible={visible}
            onClose={close}
            icon="credit-card"
            iconContainerClassName="bg-yellow-1"
            title={succeeded ? t('staleCardApprovalModal.successTitle') : t('staleCardApprovalModal.title')}
            description={
                succeeded
                    ? t('staleCardApprovalModal.successDescription')
                    : (errorMessage ?? t('staleCardApprovalModal.description'))
            }
            ctas={ctas}
        />
    )
}
