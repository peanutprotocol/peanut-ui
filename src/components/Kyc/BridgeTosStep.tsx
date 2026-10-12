'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import IframeWrapper, { type IframeCloseSource } from '@/components/Global/IframeWrapper'
import { type IconName } from '@/components/Global/Icons/Icon'
import { getBridgeTosLink } from '@/app/actions/users'
import { useAuth } from '@/context/authContext'
import { confirmBridgeTosAndAwaitRails } from '@/hooks/useMultiPhaseKycFlow'
import { useBridgeProviderId } from '@/hooks/useBridgeProviderId'
import { BridgeTermsCard } from '@/components/Kyc/BridgeTermsCard'

interface BridgeTosStepProps {
    visible: boolean
    onComplete: () => void
    onSkip: () => void
}

// shown immediately after sumsub kyc approval when bridge rails need ToS acceptance.
// displays a prompt that names the account provider and links its terms, then
// opens the bridge ToS iframe. The prompt accepts nothing: the user accepts on
// Bridge's page. The `tos_acceptance_link` endpoint serves the terms the
// customer still owes (base or SEPA v2), so the prompt is the same for both.
export const BridgeTosStep = ({ visible, onComplete, onSkip }: BridgeTosStepProps) => {
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')
    const { fetchUser } = useAuth()
    const providerId = useBridgeProviderId()
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

    const handleContinue = useCallback(async () => {
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
        async (source?: IframeCloseSource) => {
            if (source === 'tos_accepted' || source === 'returned') {
                setIsConfirming(true)
                setShowIframe(false)
                try {
                    const accepted = await confirmBridgeTosAndAwaitRails(fetchUser, {
                        observedAcceptance: source === 'tos_accepted',
                    })
                    // `returned` only means the system browser closed, so a user
                    // who backed out lands back on the prompt instead of being
                    // told the step is done.
                    if (source === 'returned' && !accepted) {
                        setError(t('bridgeTos.notAcceptedYet'))
                        return
                    }
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

    return (
        <>
            {/* confirmation modal — hidden when iframe is open or ToS is being confirmed */}
            <ActionModal
                visible={visible && !showIframe && !isConfirming}
                onClose={onSkip}
                tone={error ? 'error' : 'info'}
                icon={error ? ('alert' as IconName) : ('badge' as IconName)}
                title={error ? t('bridgeTos.errorTitle') : t('bridgeTos.title')}
                description={error || t('bridgeTos.description')}
                content={error ? undefined : <BridgeTermsCard providerId={providerId} />}
                ctas={[
                    {
                        text: isLoading ? tCommon('loading') : error ? tCommon('tryAgain') : tCommon('continue'),
                        onClick: handleContinue,
                        disabled: isLoading,
                        variant: 'primary',
                        className: 'w-full',
                        shadowSize: '4',
                    },
                ]}
                tertiaryCta={{ text: t('bridgeTos.notNow'), onClick: onSkip }}
            />

            {tosLink && <IframeWrapper src={tosLink} visible={showIframe} onClose={handleIframeClose} />}
        </>
    )
}
