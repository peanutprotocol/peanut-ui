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
import {
    useWeb3InboxAccount,
    useRegister,
    useSubscribe,
    useSubscription,
    usePrepareRegistration,
} from '@web3inbox/react'
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

    const { address } = useAccount({})
    const { signMessageAsync } = useSignMessage()
    const { data: account, setAccount, identityKey, isRegistered } = useWeb3InboxAccount()
    const { register: registerIdentity } = useRegister()
    const { subscribe, isLoading: isSubscribing } = useSubscribe()
    const { data: subscription } = useSubscription()
    const isSubscribed = Boolean(subscription)
    const { prepareRegistration } = usePrepareRegistration()

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
        if (isSubscribed && isLoading) {
            setIsLoading(false)
        }
    }, [isSubscribed, address])

    const handleRegistration = useCallback(async () => {
        if (!account) return
        try {
            setIsLoading(true)
            const { message, registerParams } = await prepareRegistration()
            const signature = await signMessageAsync({ message: message })
            await registerIdentity({ registerParams, signature })
                .then(async () => {
                    await handleSubscribe(true)
                })
                .catch((err: any) => {
                    console.error({ err })
                    setIsLoading(false)
                })
        } catch (registerIdentityError) {
            setIsLoading(true)
            console.error({ registerIdentityError })
        }
    }, [signMessage, registerIdentity, account])

    const handleSubscribe = useCallback(
        async (hasJustRegistered?: boolean) => {
            try {
                if (!identityKey && !hasJustRegistered) {
                    await handleRegistration()
                }
                setIsLoading(true)
                await subscribe()
            } catch (error) {
                console.error({ error })
            }
        },
        [subscribe, identityKey]
    )

    useEffect(() => {
        if (!address) {
            setAccount('')
            return
        }
        setAccount(`eip155:1:${address}`)
    }, [address])

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
        <div
            className={`flex w-full flex-col items-center justify-center gap-6 py-2 text-center ${link ? 'pb-20' : 'pb-2'}`}
        >
            <label className="text-h2">Yay!</label>
            {link && <QRCodeWrapper url={link} />}
            <label className="text-h8 ">
                {createType === 'direct'
                    ? `You have successfully sent the funds to ${recipient.endsWith('.eth') ? recipient : utils.shortenAddressLong(recipient)}.`
                    : 'Share this link or QR code with the recipient. They will be able to claim the funds on any chain in any token.'}
            </label>
            {link && (
                <div className="flex w-full flex-col items-center justify-center gap-2 ">
                    {createType === 'email_link' && (
                        <>
                            <button
                                className="w-full border border-n-1 bg-purple-1 px-2 py-1 text-h8 font-normal"
                                onClick={() => {
                                    utils.shareToEmail(recipient, link, txUsdValue)
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
                                    utils.shareToSms(recipient, link, txUsdValue)
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
                        className="w-full border border-n-1 bg-purple-1 px-2 py-1 text-h8 font-normal sm:hidden"
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

            {link && (
                <div
                    className="absolute bottom-0 flex h-20 w-[27rem] w-full flex-row items-center justify-start gap-2 border-t-[1px] border-black bg-purple-3  px-4.5 dark:text-black"
                    onClick={() => {
                        if (!isRegistered) {
                            handleRegistration()
                        } else if (!isSubscribed) {
                            handleSubscribe()
                        } else {
                            window.open('https://app.web3inbox.com/notifications/peanut.to', '_blank')
                        }
                    }}
                >
                    <div className=" border border-n-1 p-0 px-1">
                        <Icon name="email" className="-mt-0.5" />
                    </div>
                    {isRegistered && isSubscribed ? (
                        <label className="cursor-pointer text-sm font-bold">
                            {' '}
                            Click here to see your notifications{' '}
                        </label>
                    ) : (
                        <label className="cursor-pointer text-sm font-bold">
                            Subscribe to get notified when you link gets claimed!
                        </label>
                    )}
                </div>
            )}
        </div>
    )
}
