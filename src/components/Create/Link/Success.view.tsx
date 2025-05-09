'use client'
import CopyField from '@/components/Global/CopyField'
import Icon from '@/components/Global/Icon'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { tokenSelectorContext } from '@/context'
import { copyTextToClipboardWithFallback, getExplorerUrl, printableAddress, shareToEmail, shareToSms } from '@/utils'
import { useToast } from '@chakra-ui/react'
import Link from 'next/link'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ICreateScreenProps } from '../Create.consts'

import { useSignMessage } from 'wagmi'

export const CreateLinkSuccessView = ({ link, txHash, createType, recipient, tokenValue }: ICreateScreenProps) => {
    const { selectedChainID, selectedTokenAddress, inputDenomination, selectedTokenPrice } =
        useContext(tokenSelectorContext)
    const toast = useToast()

    const { signMessageAsync } = useSignMessage()

    const [isLoading, setIsLoading] = useState(false)

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
                    ? `You have successfully sent the funds to ${recipient.name?.endsWith('.eth') ? recipient.name : printableAddress(recipient.address ?? '')}.`
                    : 'Share this link or QR code with the recipient. They will be able to claim the funds on any chain in any token.'}
            </label>
            {link && (
                <div className="flex w-full flex-col items-center justify-center gap-2 ">
                    {createType === 'email_link' && (
                        <>
                            <button
                                className="w-full border border-n-1 bg-purple-1 px-2 py-1 text-h8 font-normal"
                                onClick={() => {
                                    shareToEmail(recipient.name ?? '', link, txUsdValue)
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
                                    shareToSms(recipient.name ?? '', link, txUsdValue)
                                }}
                            >
                                Share via SMS
                            </button>
                            or
                        </>
                    )}
                    <div className="w-full">
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
