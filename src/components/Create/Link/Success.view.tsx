'use client'
import CopyField from '@/components/Global/CopyField'
import Icon from '@/components/Global/Icon'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import * as _consts from '../Create.consts'
import * as consts from '@/constants'
import * as context from '@/context'
import {
    useWeb3InboxAccount,
    useRegister,
    useSubscribe,
    useSubscription,
    usePrepareRegistration,
} from '@web3inbox/react'
import { useAccount, useSignMessage } from 'wagmi'

export const CreateLinkSuccessView = ({ link, txHash }: _consts.ICreateScreenProps) => {
    const { selectedChainID } = useContext(context.tokenSelectorContext)

    const { address } = useAccount({})
    const { signMessageAsync } = useSignMessage()
    const { data: account, setAccount, identityKey, isRegistered } = useWeb3InboxAccount()
    const { register: registerIdentity } = useRegister()
    const { subscribe, isLoading: isSubscribing } = useSubscribe()
    const { data: subscription } = useSubscription()
    const isSubscribed = Boolean(subscription)
    const { prepareRegistration } = usePrepareRegistration()

    const [isLoading, setIsLoading] = useState(false)

    const explorerUrlWithTx = useMemo(
        () =>
            `${consts.supportedPeanutChains.find((detail) => detail.chainId === selectedChainID)?.explorers[0].url}/tx/${txHash}`,
        [txHash, selectedChainID]
    )
    const share = async (url: string) => {
        try {
            await navigator.share({
                title: 'Peanut Protocol',
                text: 'Peanut Protocol',
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
            console.log(isSubscribed)
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

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 py-2 pb-20 text-center">
            <label className="text-h2">Yay!</label>
            <QRCodeWrapper url={link} />
            <label className="text-h8 font-bold ">
                Scan the QR code above or send this link to your friends so they can claim their funds.
            </label>
            <div className="hidden w-full md:block">
                <CopyField text={link} />
            </div>
            <div
                className="w-full border border-n-1 px-2 py-1 text-h8 font-normal sm:hidden"
                onClick={() => {
                    share(link)
                }}
            >
                Share link
            </div>
            <Link
                className="cursor-pointer self-start text-h8 font-bold text-gray-1 underline"
                href={`${explorerUrlWithTx}`}
            >
                Transaction hash
            </Link>

            <div className="absolute bottom-0 -mb-0.5 flex h-20 w-[27rem] w-full flex-row items-center justify-center gap-2  border border-black border-n-1 bg-purple-3  px-4.5 dark:text-black">
                <div
                    className="cursor-pointer border border-n-1 p-0 px-1"
                    onClick={() => {
                        if (!isRegistered) {
                            handleRegistration()
                        } else if (!isSubscribed) {
                            handleSubscribe()
                        }
                    }}
                >
                    <Icon name="email" className="-mt-0.5" />
                </div>
                {isRegistered && isSubscribed ? (
                    <label className="text-sm font-bold">
                        {' '}
                        Click{' '}
                        <Link className="underline" href={'https://app.web3inbox.com'}>
                            here
                        </Link>{' '}
                        to see your notifications{' '}
                    </label>
                ) : (
                    <label className="text-sm font-bold">Subscribe to get notified when you link gets claimed!</label>
                )}
            </div>
        </div>
    )
}
