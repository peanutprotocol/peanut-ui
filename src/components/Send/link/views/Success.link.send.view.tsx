'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import ShareButton from '@/components/Global/ShareButton'
import { SuccessViewDetailsCard } from '@/components/Global/SuccessViewComponents/SuccessViewDetailsCard'
import { useAppDispatch, useSendFlowStore } from '@/redux/hooks'
import { sendFlowActions } from '@/redux/slices/send-flow-slice'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useWallet } from '@/hooks/wallet/useWallet'
import { captureException } from '@sentry/nextjs'
import { sendLinksApi } from '@/services/sendLinks'
import { useUserStore } from '@/redux/hooks'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { useState } from 'react'

const LinkSendSuccessView = () => {
    const dispatch = useAppDispatch()
    const router = useRouter()
    const { link, attachmentOptions, tokenValue } = useSendFlowStore()
    const queryClient = useQueryClient()
    const { fetchBalance } = useWallet()
    const { user } = useUserStore()
    const [isLoading, setIsLoading] = useState<boolean>(false)

    return (
        <div className="relative space-y-8">
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
                            onClick={() => {
                                setIsLoading(true)
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
                            variant={'primary-soft'}
                            className="flex w-full items-center gap-1"
                            shadowSize="4"
                            disabled={isLoading}
                        >
                            <div className="flex size-6 items-center gap-0">
                                <Icon name="cancel" />
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
