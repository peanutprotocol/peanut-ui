'use client'

import CopyField from '@/components/Global/CopyField'
import Icon from '@/components/Global/Icon'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { useContext, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import * as _consts from '../Create.consts'
import * as utils from '@/utils'
import * as context from '@/context'
import { useToast } from '@chakra-ui/react'
import { Button, Card } from '@/components/0_Bruddle'

export const CreateLinkSuccessView = ({
    link,
    txHash,
    createType,
    recipient,
    tokenValue,
}: _consts.ICreateScreenProps) => {
    const { selectedChainID, inputDenomination, selectedTokenPrice } = useContext(context.tokenSelectorContext)
    const toast = useToast()

    const [txUsdValue, setTxUsdValue] = useState<string | undefined>(undefined)

    const explorerUrlWithTx = useMemo(
        () => `${utils.getExplorerUrl(selectedChainID)}/tx/${txHash}`,
        [txHash, selectedChainID]
    )
    const share = async (url: string) => {
        try {
            await navigator.share({
                title: 'Peanut Protocol',
                text: 'Claim your funds here: ',
                url,
            })
        } catch (error: any) {
            toast({
                title: 'Sharing failed',
                description: 'Sharing does not work within another app. The link has been copied to clipboard.',
                status: 'warning',
                duration: 9000,
                isClosable: true,
                variant: 'subtle',
            })
            utils.copyTextToClipboardWithFallback(url)
            console.log(error)
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
        <div className={`flex w-full flex-col items-center justify-center p-2`}>
            <Card>
                <Card.Header>
                    <Card.Title>Yay !</Card.Title>
                </Card.Header>
                <Card.Content className="flex flex-col gap-4">
                    {link && <QRCodeWrapper url={link} />}
                    {createType === 'direct'
                        ? `You have successfully sent the funds to ${recipient.name?.endsWith('.eth') ? recipient.name : utils.printableAddress(recipient.address ?? '')}.`
                        : 'Share this link or QR code with the recipient. They will be able to claim the funds on any chain in any token.'}
                    {link && (
                        <div className="flex w-full flex-col items-center justify-center gap-2 ">
                            {createType === 'email_link' && (
                                <>
                                    <Button
                                        onClick={() => {
                                            utils.shareToEmail(recipient.name ?? '', link, txUsdValue)
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
                                            utils.shareToSms(recipient.name ?? '', link, txUsdValue)
                                        }}
                                    >
                                        Share via SMS
                                    </Button>
                                    or
                                </>
                            )}
                            <div className="hidden w-full md:block">
                                <CopyField text={link} />
                            </div>
                            <div className="flex w-full flex-col gap-2 md:flex-row">
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
                                        <Icon name="external" className="h-4 fill-gray-1" />
                                    </Button>
                                </Link>
                                <Link className="" href={'/profile'}>
                                    <Button variant="stroke" className="text-nowrap">
                                        <div className="border border-n-1 p-0 px-1">
                                            <Icon name="profile" className="-mt-0.5" />
                                        </div>
                                        See your payments.
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    )}
                </Card.Content>
            </Card>
        </div>
    )
}
