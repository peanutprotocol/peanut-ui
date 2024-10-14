'use client'
import CopyField from '@/components/Global/CopyField'
import Icon from '@/components/Global/Icon'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import * as _consts from '../Create.consts'
import * as consts from '@/constants'
import * as utils from '@/utils'
import * as context from '@/context'
import { useToast } from '@chakra-ui/react'

import { useAccount, useSignMessage } from 'wagmi'

export const CreateLinkSuccessView = ({
    link,
    txHash,
    createType,
    recipient,
    tokenValue,
}: _consts.ICreateScreenProps) => {
    const { selectedChainID, selectedTokenAddress, inputDenomination, selectedTokenPrice } = useContext(
        context.tokenSelectorContext
    )
    const toast = useToast()

    const { address } = useAccount({})
    const { signMessageAsync } = useSignMessage()

    const [isLoading, setIsLoading] = useState(false)

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

    const signMessage = useCallback(
        async (message: string) => {
            const res = await signMessageAsync({
                message,
            })

            return res as string
        },
        [signMessageAsync]
    )

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
        <div className={`flex w-full flex-col items-center justify-center gap-6 py-2 pb-20 text-center`}>
            <label className="text-h2">Yay!</label>
            {link && <QRCodeWrapper url={link} />}
            <label className="text-h8 ">
                {createType === 'direct'
                    ? `You have successfully sent the funds to ${recipient.name?.endsWith('.eth') ? recipient.name : utils.printableAddress(recipient.address ?? '')}.`
                    : 'Share this link or QR code with the recipient. They will be able to claim the funds on any chain in any token.'}
            </label>
            {link && (
                <div className="flex w-full flex-col items-center justify-center gap-2 ">
                    {createType === 'email_link' && (
                        <>
                            <button
                                className="w-full border border-n-1 bg-purple-1 px-2 py-1 text-h8 font-normal"
                                onClick={() => {
                                    utils.shareToEmail(recipient.name ?? '', link, txUsdValue)
                                }}
                            >
                                Share via email
                            </button>
                            or
                        </>
                    )}
                    {createType === 'sms_link' && (
                        <>
                            <button
                                className="w-full border border-n-1 bg-purple-1 px-2 py-1 text-h8 font-normal"
                                onClick={() => {
                                    utils.shareToSms(recipient.name ?? '', link, txUsdValue)
                                }}
                            >
                                Share via SMS
                            </button>
                            or
                        </>
                    )}
                    <div className="hidden w-full md:block">
                        <CopyField text={link} />
                    </div>
                    <div
                        className={`w-full border border-n-1  px-2 py-1 text-h8 font-normal sm:hidden ${createType === 'email_link' || createType === 'sms_link' ? '' : 'bg-purple-1'}`}
                        onClick={() => {
                            share(link)
                        }}
                    >
                        Share link
                    </div>
                </div>
            )}

            <Link
                className="cursor-pointer text-h8 font-bold text-gray-1 underline"
                target="_blank"
                href={`${explorerUrlWithTx}`}
            >
                Transaction hash
            </Link>

            <Link
                className="absolute bottom-0 flex h-20 w-[27rem] w-full flex-row items-center justify-start gap-2 border-t-[1px] border-black bg-purple-3  px-4.5 dark:text-black"
                href={'/profile'}
            >
                <div className=" border border-n-1 p-0 px-1">
                    <Icon name="profile" className="-mt-0.5" />
                </div>
                See your payments.
            </Link>
        </div>
    )
}
