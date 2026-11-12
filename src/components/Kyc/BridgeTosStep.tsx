'use client'

import * as Sentry from '@/utils/sentry-lazy'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import IframeWrapper, { type IframeCloseSource } from '@/components/Global/IframeWrapper'
import { type IconName } from '@/components/Global/Icons/Icon'
import { getBridgeTosLink } from '@/app/actions/users'
import { useAuth } from '@/context/authContext'
import { resolveBridgeTosClose } from '@/hooks/useMultiPhaseKycFlow'
import { useBridgeProviderId } from '@/hooks/useBridgeProviderId'
import { BridgeTermsCard } from '@/components/Kyc/BridgeTermsCard'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import posthog from 'posthog-js'
import { useKycControl } from '@/features/paperwork-verification/analytics'

interface BridgeTosStepProps {
    visible: boolean
    country?: string
    onComplete: () => void
    onSkip: () => void
}

// shown immediately after sumsub kyc approval when bridge rails need ToS acceptance.
// displays a prompt that names the account provider and links its terms, then
// opens the bridge ToS iframe. The prompt accepts nothing: the user accepts on
// Bridge's page. The `tos_acceptance_link` endpoint serves the terms the
// customer still owes (base or SEPA v2), so the prompt is the same for both.
export const BridgeTosStep = ({ visible, country, onComplete, onSkip }: BridgeTosStepProps) => {
    const { track } = useKycControl('tos', 'kyc_legacy')
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')
    const { fetchUser, user } = useAuth()
    const providerId = useBridgeProviderId()
    const [showIframe, setShowIframe] = useState(false)
    const [tosLink, setTosLink] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isConfirming, setIsConfirming] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [signed, setSigned] = useState(false)
    const openPage = useRef(false)
    const confirming = useRef(false)
    const lifetime = useRef(0)

    // reset state when step is hidden
    useEffect(() => {
        openPage.current = false
        confirming.current = false
        setSigned(false)
        setShowIframe(false)
        setIsConfirming(false)
        setIsLoading(false)
        setTosLink(null)
        setError(null)
        return () => {
            lifetime.current += 1
        }
    }, [visible, country, user?.user?.userId])

    const confirm = useCallback(
        async (source: Exclude<IframeCloseSource, 'manual'>) => {
            if (confirming.current) return
            const generation = lifetime.current
            confirming.current = true
            setIsConfirming(true)
            try {
                const accepted = await resolveBridgeTosClose(fetchUser, source, country)
                if (generation !== lifetime.current) return
                if (accepted) {
                    onComplete()
                    return
                }
                setError(t(source === 'tos_accepted' ? 'bridgeTos.confirmError' : 'bridgeTos.notAcceptedYet'))
            } catch (error) {
                if (generation !== lifetime.current) return
                Sentry.captureException(error, { tags: { ...criticalFlowTags('kyc'), kyc_step: 'tos_confirm' } })
                setError(t('bridgeTos.confirmError'))
            } finally {
                if (generation === lifetime.current) {
                    confirming.current = false
                    setIsConfirming(false)
                }
            }
        },
        [fetchUser, country, onComplete, t]
    )

    const handleContinue = useCallback(async () => {
        track(error ? 'retry' : 'continue', 'tap')
        if (signed) return confirm('tos_accepted')
        const generation = lifetime.current
        setIsLoading(true)
        setError(null)

        try {
            const response = await getBridgeTosLink()
            if (generation !== lifetime.current) return

            if (response.error || !response.data?.tosLink) {
                // if we can't get the tos link (e.g. bridge customer not created yet),
                // skip this step — the activity feed will show a reminder later
                setError(response.error || t('bridgeTos.loadFailed'))
                return
            }

            setTosLink(response.data.tosLink)
            openPage.current = true
            setShowIframe(true)
            posthog.capture(ANALYTICS_EVENTS.KYC_TOS_OPENED)
        } catch (error) {
            if (generation !== lifetime.current) return
            Sentry.captureException(error, { tags: { ...criticalFlowTags('kyc'), kyc_step: 'tos_open' } })
            setError(t('bridgeTos.genericError'))
        } finally {
            if (generation === lifetime.current) setIsLoading(false)
        }
    }, [t, error, track, signed, confirm])

    const handleIframeClose = useCallback(
        async (source: IframeCloseSource = 'manual') => {
            if (!openPage.current) return
            openPage.current = false
            setShowIframe(false)
            if (source === 'manual') {
                track('tos_page', 'dismiss')
                onSkip()
                return
            }
            if (source === 'tos_accepted') setSigned(true)
            await confirm(source)
        },
        [confirm, onSkip, track]
    )

    if (!visible) return null

    return (
        <>
            {/* confirmation modal — hidden when iframe is open or ToS is being confirmed */}
            <ActionModal
                visible={visible && !showIframe && !isConfirming}
                onClose={() => {
                    track('tos', 'dismiss')
                    onSkip()
                }}
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
                tertiaryCta={{
                    text: t('bridgeTos.notNow'),
                    onClick: () => {
                        track('not_now', 'tap')
                        onSkip()
                    },
                }}
            />

            {tosLink && <IframeWrapper src={tosLink} visible={showIframe} onClose={handleIframeClose} />}
        </>
    )
}
