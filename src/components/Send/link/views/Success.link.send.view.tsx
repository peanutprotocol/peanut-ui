'use client'

import { Button } from '@/components/0_Bruddle/Button'
import CancelSendLinkModal from '@/components/Global/CancelSendLinkModal'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import PeanutLoading from '@/components/Global/PeanutLoading'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import ShareButton from '@/components/Global/ShareButton'
import { SuccessViewDetailsCard } from '@/components/Global/SuccessViewComponents/SuccessViewDetailsCard'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAppDispatch, useSendFlowStore, useUserStore } from '@/redux/hooks'
import { sendFlowActions } from '@/redux/slices/send-flow-slice'
import { sendLinksApi } from '@/services/sendLinks'
import { captureException } from '@sentry/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const LinkSendSuccessView = () => {
    const dispatch = useAppDispatch()
    const router = useRouter()
    const { link, attachmentOptions, tokenValue } = useSendFlowStore()
    const queryClient = useQueryClient()
    const { fetchBalance } = useWallet()
    const { user } = useUserStore()
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [showCancelLinkModal, setshowCancelLinkModal] = useState(false)

    if (isLoading) {
        return <PeanutLoading coverFullScreen />
    }

    return (
        <div className="flex min-h-[inherit] w-full flex-col justify-start space-y-8">
            <NavHeader
                icon="cancel"
                title="Send"
                onPrev={() => {
                    router.push('/home')
                    dispatch(sendFlowActions.resetSendFlow())
                }}
            />
            <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                {link && (
                    <SuccessViewDetailsCard
                        title="Link created!"
                        amountDisplay={tokenValue}
                        description={attachmentOptions.message}
                        status={'completed'}
                    />
                )}

                {link && <QRCodeWrapper url={link} />}

                {link && (
                    <div className="flex w-full flex-col items-center justify-center gap-4">
                        <ShareButton url={link} title="Share link">
                            Share link
                        </ShareButton>
                        <Button
                            onClick={() => setshowCancelLinkModal(true)}
                            variant={'primary-soft'}
                            className="flex w-full items-center gap-1"
                            shadowSize="4"
                            disabled={isLoading}
                        >
                            {!isLoading && (
                                <div className="flex items-center">
                                    <Icon
                                        name="cancel"
                                        className="mr-0.5 min-w-3 rounded-full border border-black p-0.5"
                                    />
                                </div>
                            )}
                            <span>Cancel link</span>
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
                    onClick={() => {
                        setIsLoading(true)
                        setshowCancelLinkModal(false)
                        sendLinksApi
                            .claim(user!.user.username!, link)
                            .then(() => {
                                // Claiming takes time, so we need to invalidate both transaction query types
                                setTimeout(() => {
                                    fetchBalance()
                                    queryClient
                                        .invalidateQueries({
                                            queryKey: ['transactions'],
                                        })
                                        .then(() => {
                                            setIsLoading(false)
                                            router.push('/home')
                                            dispatch(sendFlowActions.resetSendFlow())
                                        })
                                }, 3000)
                            })
                            .catch((error) => {
                                captureException(error)
                                console.error('Error claiming link:', error)
                                setIsLoading(false)
                            })
                    }}
                />
            )}
        </div>
    )
}

export default LinkSendSuccessView
