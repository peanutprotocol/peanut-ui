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
            if (source === 'tos_accepted') {
                // keep iframe mounted while confirming to prevent the ActionModal from flashing
                setIsConfirming(true)
                setShowIframe(false)
                await confirmBridgeTosAndAwaitRails(fetchUser)
                setIsConfirming(false)
                onComplete()
            } else {
                setShowIframe(false)
                onSkip()
            }
        },
        [fetchUser, onComplete, onSkip]
    )

    if (!visible) return null

    return (
        <>
            {/* confirmation modal — hidden when iframe is open or ToS is being confirmed */}
            <ActionModal
                visible={visible && !showIframe && !isConfirming}
                onClose={onSkip}
                icon={error ? ('alert' as IconName) : ('badge' as IconName)}
                title={error ? 'Could not load terms' : 'Accept Terms of Service'}
                description={
                    error || "To enable bank transfers, you need to accept our payment partner's Terms of Service."
                }
                ctas={[
                    {
                        text: isLoading ? 'Loading...' : error ? 'Try again' : 'Accept Terms',
                        onClick: handleAcceptTerms,
                        disabled: isLoading,
                        variant: 'purple',
                        className: 'w-full',
                        shadowSize: '4',
                    },
                    {
                        text: 'Not now',
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
