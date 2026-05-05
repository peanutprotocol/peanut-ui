'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import ActionModal from '@/components/Global/ActionModal'
import IframeWrapper from '@/components/Global/IframeWrapper'
import { type IconName } from '@/components/Global/Icons/Icon'
import { getBridgeTosLink, confirmBridgeTos } from '@/app/actions/users'
import { useAuth } from '@/context/authContext'
import { confirmBridgeTosAndAwaitRails } from '@/hooks/useMultiPhaseKycFlow'
import { isCapacitor } from '@/utils/capacitor'
import { openExternalUrl } from '@/utils/capacitor'

interface BridgeTosStepProps {
    visible: boolean
    onComplete: () => void
    onSkip: () => void
}

// shown immediately after sumsub kyc approval when bridge rails need ToS acceptance.
// on web: opens bridge ToS in an iframe.
// on native: opens in system browser, polls for acceptance.
export const BridgeTosStep = ({ visible, onComplete, onSkip }: BridgeTosStepProps) => {
    const { fetchUser } = useAuth()
    const [showIframe, setShowIframe] = useState(false)
    const [tosLink, setTosLink] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const pollRef = useRef<NodeJS.Timeout | null>(null)

    // stop polling on unmount or when step becomes invisible
    useEffect(() => {
        if (!visible && pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
        }
        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current)
                pollRef.current = null
            }
        }
    }, [visible])

    // auto-fetch ToS link when step becomes visible
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
                setError(response.error || 'Could not load terms. You can accept them later from your activity feed.')
                return
            }

            // in capacitor, open in system browser and poll for acceptance
            if (isCapacitor()) {
                openExternalUrl(response.data.tosLink)
                // poll every 3s to check if user accepted ToS in the browser
                pollRef.current = setInterval(async () => {
                    try {
                        const result = await confirmBridgeTos()
                        if (result.data?.accepted) {
                            if (pollRef.current) clearInterval(pollRef.current)
                            pollRef.current = null
                            await confirmBridgeTosAndAwaitRails(fetchUser)
                            onComplete()
                        }
                    } catch {}
                }, 3000)
                return
            }

            setTosLink(response.data.tosLink)
            setShowIframe(true)
        } catch {
            setError('Something went wrong. You can accept terms later from your activity feed.')
        } finally {
            setIsLoading(false)
        }
    }, [fetchUser, onComplete])

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

    // in capacitor, show a waiting modal while user accepts ToS in browser
    if (isCapacitor() && !error) {
        return (
            <ActionModal
                visible={true}
                onClose={onSkip}
                icon={'check' as IconName}
                title="Accept Terms of Service"
                description="We've opened the terms in your browser. Please accept them there, then come back to the app."
                ctas={[
                    {
                        text: 'Open again',
                        onClick: () => tosLink && openExternalUrl(tosLink),
                        variant: 'purple',
                        className: 'w-full',
                        shadowSize: '4',
                    },
                    {
                        text: 'Skip for now',
                        onClick: () => {
                            if (pollRef.current) clearInterval(pollRef.current)
                            pollRef.current = null
                            onSkip()
                        },
                        variant: 'transparent' as const,
                        className: 'underline text-sm font-medium w-full h-fit mt-3',
                    },
                ]}
            />
        )
    }

    return (
        <>
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
