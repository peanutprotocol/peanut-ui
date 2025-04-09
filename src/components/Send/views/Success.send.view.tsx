'use client'

import { Button } from '@/components/0_Bruddle'
import CopyField from '@/components/Global/CopyField'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import StatusViewWrapper from '@/components/Global/StatusViewWrapper'
import { tokenSelectorContext } from '@/context'
import { useSendFlowStore } from '@/redux/hooks'
import { copyTextToClipboardWithFallback, getExplorerUrl } from '@/utils'
import { useToast } from '@chakra-ui/react'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { useContext, useMemo } from 'react'

const SuccessSendView = () => {
    const { selectedChainID } = useContext(tokenSelectorContext)
    const toast = useToast()
    const { link, txHash } = useSendFlowStore()

    const explorerUrlWithTx = useMemo(
        () => `${getExplorerUrl(selectedChainID)}/tx/${txHash}`,
        [txHash, selectedChainID]
    )

    const share = async (url: string) => {
        try {
            if (!navigator.share) {
                await copyTextToClipboardWithFallback(url)
                toast({
                    title: 'Link copied',
                    status: 'success',
                    duration: 3000,
                    isClosable: true,
                    variant: 'subtle',
                })
                return
            }

            await navigator.share({
                title: 'Peanut Protocol',
                text: 'Claim your funds here: ',
                url,
            })
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Sharing error:', error)
                Sentry.captureException(error)
                await copyTextToClipboardWithFallback(url)
                toast({
                    title: 'Sharing failed',
                    description: 'The link has been copied to your clipboard.',
                    status: 'info',
                    duration: 3000,
                    isClosable: true,
                    variant: 'subtle',
                })
            }
        }
    }

    return (
        <StatusViewWrapper title="Yay!" hideSupportCta>
            <div className="flex flex-col gap-6">
                {link && <QRCodeWrapper url={link} />}
                <label className="text-center text-h8">
                    Share this link or QR code with the recipient. They will be able to claim the funds on any chain in
                    any token.
                </label>
                {link && (
                    <div className="flex w-full flex-col items-center justify-center gap-2">
                        <div className="w-full">
                            <CopyField text={link} />
                        </div>
                        <div className="flex w-full flex-col gap-4">
                            <Button
                                onClick={() => {
                                    share(link)
                                }}
                            >
                                Share link
                            </Button>
                            <Link
                                className="w-full text-center font-semibold text-grey-1 underline"
                                target="_blank"
                                href={`${explorerUrlWithTx}`}
                            >
                                Transaction hash
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </StatusViewWrapper>
    )
}

export default SuccessSendView
