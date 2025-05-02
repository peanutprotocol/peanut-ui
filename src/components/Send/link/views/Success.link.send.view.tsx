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
const LinkSendSuccessView = () => {
    const dispatch = useAppDispatch()
    const router = useRouter()
    const { link, attachmentOptions, tokenValue } = useSendFlowStore()

    return (
        <div className="space-y-8">
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
                            disabled
                            variant={'primary-soft'}
                            className="flex w-full items-center gap-1"
                            shadowSize="4"
                        >
                            <div className="flex size-6 items-center gap-0">
                                <Icon name="cancel" />
                            </div>
                            <span>
                                Cancel link <span className="text-xs">(Coming soon)</span>
                            </span>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default LinkSendSuccessView
