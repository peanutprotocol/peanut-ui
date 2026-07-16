'use client'

import { Button } from '@/components/0_Bruddle/Button'
import CancelSendLinkModal from '@/components/Global/CancelSendLinkModal'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import ShareButton from '@/components/Global/ShareButton'
import { SuccessViewDetailsCard } from '@/components/Global/SuccessViewComponents/SuccessViewDetailsCard'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useLinkSendFlow } from '@/context/LinkSendFlowContext'
import { useUserStore } from '@/redux/hooks'
import { captureException } from '@sentry/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import useClaimLink from '@/components/Claim/useClaimLink'
import { useToast } from '@/components/0_Bruddle/Toast'
import { TRANSACTIONS } from '@/constants/query.consts'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

const LinkSendSuccessView = () => {
    const t = useTranslations('send')
    const tNav = useTranslations('navigation')
    const router = useRouter()
    const { link, attachmentOptions, tokenValue, resetLinkSendFlow } = useLinkSendFlow()
    const queryClient = useQueryClient()
    const { fetchBalance } = useWallet()
    const { user } = useUserStore()
    const { cancelLinkAndClaim, pollForClaimConfirmation } = useClaimLink()
    const toast = useToast()
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [showCancelLinkModal, setshowCancelLinkModal] = useState(false)

    const [cancelStatus, setCancelStatus] = useState<'idle' | 'cancelling' | 'cancelled'>('idle')
    const cancelLinkText =
        cancelStatus === 'cancelling'
            ? t('link.cancelling')
            : cancelStatus === 'cancelled'
              ? t('link.cancelled')
              : t('link.cancelLink')

    useEffect(() => {
        return () => {
            // clear state on unmount
            resetLinkSendFlow()
        }
    }, [resetLinkSendFlow])

    return (
        <div className="flex  w-full flex-col justify-start space-y-8">
            <NavHeader
                icon="cancel"
                title={tNav('send')}
                onPrev={() => {
                    router.push('/home')
                    resetLinkSendFlow()
                }}
            />
            <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                {link && (
                    <SuccessViewDetailsCard
                        title={t('link.linkCreated')}
                        amountDisplay={tokenValue}
                        description={attachmentOptions.message}
                        status={'completed'}
                    />
                )}

                {link && <QRCodeWrapper url={link} />}

                {link && (
                    <div className="flex w-full flex-col items-center justify-center gap-4">
                        <ShareButton
                            url={link}
                            title={t('link.shareLink')}
                            onSuccess={() => {
                                posthog.capture(ANALYTICS_EVENTS.SEND_LINK_SHARED, {
                                    amount: tokenValue,
                                })
                            }}
                        >
                            {t('link.shareLink')}
                        </ShareButton>
                        <Button
                            onClick={() => setshowCancelLinkModal(true)}
                            variant={'primary-soft'}
                            className="flex w-full items-center gap-1"
                            shadowSize="4"
                            disabled={isLoading || cancelStatus === 'cancelled'}
                            loading={isLoading}
                        >
                            {!isLoading && (
                                <div className="flex items-center">
                                    <Icon name="ban" size={18} />
                                </div>
                            )}
                            <span>{cancelLinkText}</span>
                        </Button>
                    </div>
                )}
            </div>

            {/* Cancel Link Modal  */}
            {link && (
                <CancelSendLinkModal
                    showCancelLinkModal={showCancelLinkModal}
                    setshowCancelLinkModal={setshowCancelLinkModal}
                    amount={`$ ${tokenValue}`}
                    isLoading={isLoading}
                    onClick={async () => {
                        try {
                            setIsLoading(true)
                            setCancelStatus('cancelling')

                            if (!user?.accounts) {
                                throw new Error('User not found for cancellation')
                            }
                            const walletAddress = user.accounts.find((acc) => acc.type === 'peanut-wallet')?.identifier
                            if (!walletAddress) {
                                throw new Error('No wallet address found for cancellation')
                            }

                            // Cancel the link by claiming it back
                            await cancelLinkAndClaim({
                                link,
                                walletAddress,
                                userId: user?.user?.userId,
                            })

                            try {
                                // Wait for transaction confirmation
                                const isConfirmed = await pollForClaimConfirmation(link)

                                if (!isConfirmed) {
                                    console.warn('Transaction confirmation timeout - proceeding with refresh')
                                }

                                // Update UI and queries
                                fetchBalance()
                                await queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })

                                setIsLoading(false)
                                setshowCancelLinkModal(false)
                                setCancelStatus('cancelled')
                                toast.success(t('link.cancelSuccess'))

                                // Brief delay for toast visibility
                                await new Promise((resolve) => setTimeout(resolve, 1500))
                                router.push('/home')
                            } catch (invalidateError) {
                                console.error('Failed to update after claim:', invalidateError)
                                captureException(invalidateError, {
                                    tags: { feature: 'cancel-link' },
                                    extra: { userId: user?.user?.userId },
                                })

                                // Still navigate even if invalidation fails
                                setIsLoading(false)
                                setshowCancelLinkModal(false)
                                setCancelStatus('cancelled')
                                toast.success(t('link.cancelSuccessRefresh'))
                                await new Promise((resolve) => setTimeout(resolve, 1500))
                                router.push('/home')
                            }
                        } catch (error: any) {
                            captureException(error)
                            console.error('Error claiming link:', error)
                            setIsLoading(false)
                            setCancelStatus('idle')
                            toast.error(t('link.cancelFailed'))
                        }
                    }}
                />
            )}
        </div>
    )
}

export default LinkSendSuccessView
