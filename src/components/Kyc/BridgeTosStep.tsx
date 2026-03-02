'use client'

import { useState, useCallback, useEffect } from 'react'
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
}

// shown immediately after sumsub kyc approval when bridge rails need ToS acceptance.
// displays a prompt, then opens the bridge ToS iframe.
export const BridgeTosStep = ({ visible, onComplete, onSkip }: BridgeTosStepProps) => {
    const { fetchUser } = useAuth()
    const [showIframe, setShowIframe] = useState(false)
    const [tosLink, setTosLink] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // auto-fetch ToS link when step becomes visible so the iframe opens directly
    // (skips the intermediate "Accept Terms" confirmation modal)
    useEffect(() => {
        if (visible) {
            handleAcceptTerms()
        } else {
            setShowIframe(false)
            setTosLink(null)
            setError(null)
        }
    }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleAcceptTerms = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await getBridgeTosLink()

            if (response.error || !response.data?.tosLink) {
                // if we can't get the tos link (e.g. bridge customer not created yet),
                // skip this step — the activity feed will show a reminder later
                setError(response.error || 'Could not load terms. You can accept them later from your activity feed.')
                return
            }

            setTosLink(response.data.tosLink)
            setShowIframe(true)
        } catch {
            setError('Something went wrong. You can accept terms later from your activity feed.')
        } finally {
            setIsLoading(false)
        }
    }, [])

    const handleIframeClose = useCallback(
        async (source?: 'manual' | 'completed' | 'tos_accepted') => {
            setShowIframe(false)

            if (source === 'tos_accepted') {
                await confirmBridgeTosAndAwaitRails(fetchUser)
                onComplete()
            } else {
                onSkip()
            }
        },
        [fetchUser, onComplete, onSkip]
    )

    if (!visible) return null

    return (
        <>
            {/* only show modal on error — normal flow goes straight to iframe */}
            {error && !showIframe && (
                <ActionModal
                    visible={true}
                    onClose={onSkip}
                    icon={'alert' as IconName}
                    title="Could not load terms"
                    description={error}
                    ctas={[
                        {
                            text: 'Try again',
                            onClick: handleAcceptTerms,
                            disabled: isLoading,
                            variant: 'purple',
                            className: 'w-full',
                            shadowSize: '4',
                        },
                        {
                            text: 'Skip for now',
                            onClick: onSkip,
                            variant: 'transparent' as const,
                            className: 'underline text-sm font-medium w-full h-fit mt-3',
                        },
                    ]}
                />
            )}

            {tosLink && <IframeWrapper src={tosLink} visible={showIframe} onClose={handleIframeClose} skipStartView />}
        </>
    )
}
