'use client'

import { Button } from '@/components/0_Bruddle'
import CopyField from '@/components/Global/CopyField'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import StatusViewWrapper from '@/components/Global/StatusViewWrapper'
import { tokenSelectorContext } from '@/context'
import {
    copyTextToClipboardWithFallback,
    getExplorerUrl,
    printableAddress,
    shareToEmail,
    shareToSms,
    validateEnsName,
} from '@/utils'
import { useToast } from '@chakra-ui/react'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { useContext, useEffect, useMemo, useState } from 'react'
import { ICreateScreenProps } from '../Create.consts'

export const CreateLinkSuccessView = ({ link, txHash, createType, recipient, tokenValue }: ICreateScreenProps) => {
    const { selectedChainID, inputDenomination, selectedTokenPrice } = useContext(tokenSelectorContext)
    const toast = useToast()

    const [txUsdValue, setTxUsdValue] = useState<string | undefined>(undefined)

    const explorerUrlWithTx = useMemo(
        () => `${getExplorerUrl(selectedChainID)}/tx/${txHash}`,
        [txHash, selectedChainID]
    )

    const share = async (url: string) => {
        try {
            // check if web share api is available
            if (!navigator.share) {
                // if not, fallback to clipboard
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

            // try web share api
            await navigator.share({
                title: 'Peanut Protocol',
                text: 'Claim your funds here: ',
                url,
            })
        } catch (error: any) {
            // only show error toast for actual sharing failures
            if (error.name !== 'AbortError') {
                // abortError happens when user cancels sharing
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

    useEffect(() => {
        let value
        if (inputDenomination == 'TOKEN') {
            if (selectedTokenPrice && tokenValue) {
                value = (parseFloat(tokenValue) * selectedTokenPrice).toString()
            } else value = undefined
        } else value = tokenValue

        if (value) {
            setTxUsdValue(value)
        }
    }, [])

    return (
        <StatusViewWrapper title="Yay!" hideSupportCta>
            <div className="flex flex-col gap-6">
                {link && <QRCodeWrapper url={link} />}
                <label className="text-center text-h8">
                    {createType === 'direct'
                        ? `You have successfully sent the funds to ${validateEnsName(recipient.name) ? recipient.name : printableAddress(recipient.address ?? '')}.`
                        : 'Share this link or QR code with the recipient. They will be able to claim the funds on any chain in any token.'}
                </label>
                {link && (
                    <div className="flex w-full flex-col items-center justify-center gap-2 ">
                        {createType === 'email_link' && (
                            <>
                                <Button
                                    onClick={() => {
                                        shareToEmail(recipient.name ?? '', link, txUsdValue)
                                    }}
                                >
                                    Share via email
                                </Button>
                                or
                            </>
                        )}
                        {createType === 'sms_link' && (
                            <>
                                <Button
                                    onClick={() => {
                                        shareToSms(recipient.name ?? '', link, txUsdValue)
                                    }}
                                >
                                    Share via SMS
                                </Button>
                                or
                            </>
                        )}
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
