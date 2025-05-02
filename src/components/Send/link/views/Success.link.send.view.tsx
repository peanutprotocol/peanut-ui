'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import ShareButton from '@/components/Global/ShareButton'
import { SuccessViewDetailsCard } from '@/components/Global/SuccessViewComponents/SuccessViewDetailsCard'
import { tokenSelectorContext } from '@/context'
import { useAppDispatch, useSendFlowStore } from '@/redux/hooks'
import { sendFlowActions } from '@/redux/slices/send-flow-slice'
import { getExplorerUrl } from '@/utils'
import Link from 'next/link'
import { useContext, useMemo } from 'react'

const LinkSendSuccessView = () => {
    const dispatch = useAppDispatch()
    const { selectedChainID } = useContext(tokenSelectorContext)
    const { link, txHash, attachmentOptions, tokenValue } = useSendFlowStore()

    const explorerUrlWithTx = useMemo(
        () => `${getExplorerUrl(selectedChainID)}/tx/${txHash}`,
        [txHash, selectedChainID]
    )

    return (
        <div className="space-y-8">
            <NavHeader
                title="Send"
                onPrev={() => {
                    dispatch(sendFlowActions.resetSendFlow())
                    dispatch(sendFlowActions.setView('INITIAL'))
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

                        {explorerUrlWithTx && (
                            <Link
                                className="w-full text-center font-semibold text-grey-1 underline"
                                target="_blank"
                                href={`${explorerUrlWithTx}`}
                            >
                                Transaction hash
                            </Link>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default LinkSendSuccessView
