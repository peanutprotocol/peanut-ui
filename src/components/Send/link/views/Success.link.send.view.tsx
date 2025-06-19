'use client'

import { Button } from '@/components/0_Bruddle/Button'
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
import CancelLinkModal from '@/components/Send/link/CancelLinkModal'

const LinkSendSuccessView = () => {
    const dispatch = useAppDispatch()
    const router = useRouter()
    const { link, attachmentOptions, tokenValue } = useSendFlowStore()
    const queryClient = useQueryClient()
    const { fetchBalance } = useWallet()
    const { user } = useUserStore()
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [showCancelModal, setShowCancelModal] = useState(false)

    const handleConfirmCancel = () => {
        setShowCancelModal(false)
        setIsLoading(true)
        sendLinksApi
            .claim(user!.user.username!, link!)
            .then(() => {
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
    }

    return (
        <div className="relative space-y-8">
            <CancelLinkModal visible={showCancelModal} amount={String(tokenValue)} onCancel={handleConfirmCancel} />
            {isLoading && <PeanutLoading coverFullScreen />}
            <NavHeader
                icon="cancel"
                title="Send"
                onPrev={() => {
                    router.push('/home')
                    dispatch(sendFlowActions.resetSendFlow())
                }}
            />
            <div className="flex flex-col gap-6">
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
                            onClick={() => setShowCancelModal(true)}
                            variant={'primary-soft'}
                            className="flex w-full items-center gap-1"
                            shadowSize="4"
                            disabled={isLoading}
                        >
                            <div className="flex items-center">
                                <Icon name="cancel" className="mr-0.5 min-w-3 rounded-full border border-black p-0.5" />
                            </div>
                            <span>Cancel link</span>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default LinkSendSuccessView
