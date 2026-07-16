'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import IframeWrapper from '@/components/Global/IframeWrapper'
import { type IconName } from '@/components/Global/Icons/Icon'
import { getBridgeTosLink } from '@/app/actions/users'
import { useAuth } from '@/context/authContext'
import { confirmBridgeTosAndAwaitRails } from '@/hooks/useMultiPhaseKycFlow'

interface BridgeTosStepProps {
    visible: boolean
    onComplete: () => void
    onSkip: () => void
    /**
     * BE-emitted reason code from the rail capability (`reason.code`). Used
     * solely to vary copy between Bridge's base ToS (`bridge_tos_required`,
     * US/ACH/Wire) and the SEPA v2 ToS (`bridge_tos_v2_required`, EUR + GBP
     * inherited). The Bridge `tos_acceptance_link` endpoint is opaque to
     * endorsement — Bridge serves the correct ToS based on the customer's
     * pending requirements — so this prop ONLY affects user-facing copy, not
     * the endpoint we call. Defaults to base copy if absent.
     */
    reasonCode?: string
}

// Capability reason codes emitted by the BE resolver for Bridge ToS rails.
// Pinned as `const` so the comparison below catches typos at compile time —
// the upstream `CapabilityReason.code` is a free-form string by contract.
const BRIDGE_TOS_V2_REQUIRED = 'bridge_tos_v2_required' as const

// shown immediately after sumsub kyc approval when bridge rails need ToS acceptance.
// displays a prompt, then opens the bridge ToS iframe.
export const BridgeTosStep = ({ visible, onComplete, onSkip, reasonCode }: BridgeTosStepProps) => {
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')
    const { fetchUser } = useAuth()
    const [showIframe, setShowIframe] = useState(false)
    const [tosLink, setTosLink] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isConfirming, setIsConfirming] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // reset state when step is hidden
    useEffect(() => {
        if (!visible) {
            setShowIframe(false)
            setIsConfirming(false)
            setTosLink(null)
            setError(null)
        }
    }, [visible])

    const handleAcceptTerms = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await getBridgeTosLink()

            if (response.error || !response.data?.tosLink) {
                // if we can't get the tos link (e.g. bridge customer not created yet),
                // skip this step — the activity feed will show a reminder later
                setError(response.error || t('bridgeTos.loadFailed'))
                return
            }

            setTosLink(response.data.tosLink)
            setShowIframe(true)
        } catch {
            setError(t('bridgeTos.genericError'))
        } finally {
            setIsLoading(false)
        }
    }, [t])

    const handleIframeClose = useCallback(
        async (source?: 'manual' | 'completed' | 'tos_accepted') => {
            if (source === 'tos_accepted') {
                setIsConfirming(true)
                setShowIframe(false)
                try {
                    await confirmBridgeTosAndAwaitRails(fetchUser)
                    onComplete()
                } catch {
                    setError(t('bridgeTos.confirmError'))
                } finally {
                    setIsConfirming(false)
                }
            } else {
                setShowIframe(false)
                onSkip()
            }
        },
        [fetchUser, onComplete, onSkip, t]
    )

    if (!visible) return null

    const isSepa = reasonCode === BRIDGE_TOS_V2_REQUIRED
    const copy = {
        title: isSepa ? t('bridgeTos.sepaTitle') : t('bridgeTos.baseTitle'),
        description: isSepa ? t('bridgeTos.sepaDescription') : t('bridgeTos.baseDescription'),
    }

    return (
        <>
            {/* confirmation modal — hidden when iframe is open or ToS is being confirmed */}
            <ActionModal
                visible={visible && !showIframe && !isConfirming}
                onClose={onSkip}
                icon={error ? ('alert' as IconName) : ('badge' as IconName)}
                title={error ? t('bridgeTos.errorTitle') : copy.title}
                description={error || copy.description}
                ctas={[
                    {
                        text: isLoading ? tCommon('loading') : error ? tCommon('tryAgain') : t('bridgeTos.acceptTerms'),
                        onClick: handleAcceptTerms,
                        disabled: isLoading,
                        variant: 'purple',
                        className: 'w-full',
                        shadowSize: '4',
                    },
                    {
                        text: t('bridgeTos.notNow'),
                        onClick: onSkip,
                        variant: 'transparent' as const,
                        className: 'underline text-sm font-medium w-full h-fit mt-3',
                    },
                ]}
            />

            {tosLink && <IframeWrapper src={tosLink} visible={showIframe} onClose={handleIframeClose} skipStartView />}
        </>
    )
}
