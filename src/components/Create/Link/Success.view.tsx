'use client'

import { Button, Card } from '@/components/0_Bruddle'
import CopyField from '@/components/Global/CopyField'
import Icon from '@/components/Global/Icon'
import { PaymentsFooter } from '@/components/Global/PaymentsFooter'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
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
        <Card className="shadow-none sm:shadow-primary-4">
            <Card.Header>
                <Card.Title>Yay!</Card.Title>
            </Card.Header>
            <Card.Content className="flex flex-col gap-4">
                {link && <QRCodeWrapper url={link} />}
                {createType === 'direct'
                    ? `You have successfully sent the funds to ${validateEnsName(recipient.name) ? recipient.name : printableAddress(recipient.address ?? '')}.`
                    : 'Share this link or QR code with the recipient. They will be able to claim the funds on any chain in any token.'}
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
                        <div className="flex w-full flex-col gap-2">
                            <Button
                                onClick={() => {
                                    share(link)
                                }}
                            >
                                Share link
                            </Button>
                            <Link className="w-full" target="_blank" href={`${explorerUrlWithTx}`}>
                                <Button variant="dark">
                                    Transaction hash
                                    <Icon name="external" className="h-4 fill-grey-1" />
                                </Button>
                            </Link>
                            <PaymentsFooter />
                        </div>
                    </div>
                )}
            </Card.Content>
        </Card>
    )
}
