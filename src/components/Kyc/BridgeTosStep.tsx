'use client'

import { useState, useCallback, useEffect } from 'react'
import ActionModal from '@/components/Global/ActionModal'
import IframeWrapper from '@/components/Global/IframeWrapper'
import { type IconName } from '@/components/Global/Icons/Icon'
import { getBridgeTosLink, confirmBridgeTos } from '@/app/actions/users'
import { useAuth } from '@/context/authContext'

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

    // reset state when visibility changes
    useEffect(() => {
        if (!visible) {
            setShowIframe(false)
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
            setShowIframe(false)

            if (source === 'tos_accepted') {
                // confirm with backend that bridge actually accepted the ToS
                const result = await confirmBridgeTos()

                if (result.data?.accepted) {
                    await fetchUser()
                    onComplete()
                    return
                }

                // bridge hasn't registered acceptance yet — poll once after a short delay
                await new Promise((resolve) => setTimeout(resolve, 2000))
                const retry = await confirmBridgeTos()

                if (retry.data?.accepted) {
                    await fetchUser()
                    onComplete()
                } else {
                    // will be caught by poller/webhook eventually
                    await fetchUser()
                    onComplete()
                }
            } else {
                // user closed without accepting — skip, activity feed will remind them
                onSkip()
            }
        },
        [fetchUser, onComplete, onSkip]
    )

    if (!visible) return null

    return (
        <>
            {!showIframe && (
                <ActionModal
                    visible={visible && !showIframe}
                    onClose={onSkip}
                    icon={'check' as IconName}
                    iconContainerClassName="bg-success-1 text-white"
                    title="Identity verified!"
                    description={
                        error ||
                        'One more step: accept terms of service to enable bank transfers in the US, Europe, and Mexico.'
                    }
                    ctas={[
                        {
                            text: error ? 'Continue' : 'Accept Terms',
                            onClick: error ? onSkip : handleAcceptTerms,
                            disabled: isLoading,
                            variant: 'purple',
                            className: 'w-full',
                            shadowSize: '4',
                        },
                        ...(!error
                            ? [
                                  {
                                      text: 'Skip for now',
                                      onClick: onSkip,
                                      variant: 'transparent' as const,
                                      className: 'underline text-sm font-medium w-full h-fit mt-3',
                                  },
                              ]
                            : []),
                    ]}
                />
            )}

            {tosLink && <IframeWrapper src={tosLink} visible={showIframe} onClose={handleIframeClose} />}
        </>
    )
}
