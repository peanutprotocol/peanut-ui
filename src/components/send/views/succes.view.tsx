import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'react-qr-code'

import dropdown_svg from '@/assets/dropdown.svg'

import * as _consts from '../send.consts'
import { useAtom } from 'jotai'
import * as store from '@/store/store'
import * as global_components from '@/components/global'
import * as utils from '@/utils'
import { useAccount, useSignMessage } from 'wagmi'
import { useManageSubscription, useW3iAccount } from '@web3inbox/widget-react'

export function SendSuccessView({ onCustomScreen, claimLink, txHash, chainId }: _consts.ISendScreenProps) {
    //web3inbox stuff
    const { address } = useAccount({
        onDisconnect: () => {
            setAccount('')
        },
    })
    const { signMessageAsync } = useSignMessage()
    const { account, setAccount, register: registerIdentity, identityKey, isRegistered } = useW3iAccount()
    const { isSubscribed, subscribe, isSubscribing } = useManageSubscription(`eip155:1:${address}`)

    const [isLoading, setIsLoading] = useState(false)
    const [loadingText, setLoadingText] = useState('')
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [isCopied, setIsCopied] = useState(false)
    const [copiedLink, setCopiedLink] = useState<string[]>()
    const [copiedAll, setCopiedAll] = useState(false)
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)
    const explorerUrlWithTx = useMemo(
        () => chainDetails.find((detail) => detail.chainId === chainId)?.explorers[0].url + '/tx/' + txHash,
        [txHash, chainId]
    )

    useEffect(() => {
        if (copiedAll) {
            setTimeout(() => {
                setCopiedAll(false)
            }, 3000)
        }
    }, [])

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
        if (!Boolean(address)) return
        setAccount(`eip155:1:${address}`)
    }, [signMessage, address, setAccount])

    useEffect(() => {
        if (isSubscribed && isLoading) {
            console.log(isSubscribed)
            setIsLoading(false)
        }
    }, [isSubscribed, address, window])

    const handleRegistration = useCallback(async () => {
        if (!account) return
        try {
            setIsLoading(true)
            setLoadingText('Confirm in wallet')
            await registerIdentity(signMessage)
                .then(async () => {
                    await handleSubscribe(true)
                })
                .catch((err) => {
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
                setLoadingText('Subscribing')
                await subscribe()
            } catch (error) {
                console.error({ error })
            }
        },
        [subscribe, identityKey]
    )

    useEffect(() => {
        console.log({ isSubscribed, isRegistered, isSubscribing })
        console.log(isSubscribed)
    }, [isSubscribed, isRegistered, isSubscribing])

    return (
        <>
            <div className="flex w-full flex-col items-center text-center ">
                <h2 className="title-font text-5xl font-black text-black">Yay!</h2>
                {claimLink.length == 1 ? (
                    <p className="mt-2 self-center text-lg">
                        Send this link to your friend so they can claim their funds.
                    </p>
                ) : (
                    <p className="mt-2 self-center text-lg">Here are the links you created.</p>
                )}

                {claimLink.length == 1 ? (
                    <div className="brutalborder relative mt-4 flex w-4/5 items-center bg-black py-1 text-white ">
                        <div className="flex w-[90%] items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all bg-black p-2 text-lg font-normal text-white">
                            {claimLink}
                        </div>
                        <div
                            className="min-w-32 absolute right-0 top-0 flex h-full cursor-pointer items-center justify-center border-none bg-white px-1 text-black md:px-4"
                            onClick={() => {
                                navigator.clipboard.writeText(claimLink[0])
                                setIsCopied(true)
                            }}
                        >
                            {isCopied ? (
                                <div className="flex h-full cursor-pointer items-center border-none bg-white text-base font-bold ">
                                    <span className="tooltiptext inline w-full justify-center" id="myTooltip">
                                        {' '}
                                        copied!{' '}
                                    </span>
                                </div>
                            ) : (
                                <button className="h-full cursor-pointer gap-2 border-none bg-white p-0 text-base font-bold ">
                                    <label className="cursor-pointer text-black">COPY</label>
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <ul className="brutalscroll max-h-[360px] w-4/5 flex-col items-center justify-center overflow-x-hidden overflow-y-scroll p-2">
                        {claimLink &&
                            claimLink.map((link, index) => (
                                <li
                                    className="brutalborder relative mb-4 flex w-full items-center bg-black py-1 text-white"
                                    key={index}
                                >
                                    <div className="flex w-[90%] items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all bg-black p-2 text-lg font-normal text-white">
                                        {link}
                                    </div>

                                    <div
                                        className="min-w-32 absolute right-0 top-0 flex h-full cursor-pointer items-center justify-center border-none bg-white px-1 text-black md:px-4"
                                        onClick={() => {
                                            navigator.clipboard.writeText(link)
                                            setCopiedLink([link])
                                        }}
                                    >
                                        {copiedLink?.includes(link) ? (
                                            <div className="flex h-full items-center border-none bg-white text-base font-bold">
                                                <span
                                                    className="tooltiptext inline w-full justify-center"
                                                    id="myTooltip"
                                                >
                                                    Copied!
                                                </span>
                                            </div>
                                        ) : (
                                            <button className="h-full cursor-pointer gap-2 border-none bg-white p-0 text-base font-bold">
                                                <label className="cursor-pointer text-black">COPY</label>
                                            </button>
                                        )}
                                    </div>
                                </li>
                            ))}
                    </ul>
                )}

                <div
                    className={
                        ' flex flex-col items-center justify-center ' + (isSubscribed ? ' mt-2 gap-4 ' : ' mt-8 gap-6 ')
                    }
                >
                    {!isRegistered || !isSubscribed ? (
                        <div className="flex flex-col items-center justify-center gap-4">
                            <button
                                className=" block w-[90%] cursor-pointer bg-white px-4 py-2 font-black sm:w-2/5 lg:w-1/2"
                                id="cta-btn-2"
                                onClick={() => {
                                    if (!isRegistered) {
                                        handleRegistration()
                                    } else if (!isSubscribed) {
                                        handleSubscribe()
                                    }
                                }}
                            >
                                {isLoading ? (
                                    <div className=" m-0 flex items-center justify-center gap-2 p-0 text-center">
                                        <p className="text-m m-0 p-0">{loadingText}</p>{' '}
                                        <span className="bouncing-dots flex">
                                            <span className="dot">.</span>
                                            <span className="dot">.</span>
                                            <span className="dot">.</span>
                                        </span>
                                    </div>
                                ) : (
                                    <p className="text-m m-0 p-0">Subscribe</p>
                                )}
                            </button>
                            <p className="text-m m-0" id="">
                                Get notified when your link gets claimed!
                            </p>
                        </div>
                    ) : (
                        <p className="text-m" id="">
                            You will be notified when your fren claims their funds!
                        </p>
                    )}

                    {claimLink.length == 1 ? (
                        <div
                            className="flex cursor-pointer items-center justify-center"
                            onClick={() => {
                                setIsDropdownOpen(!isDropdownOpen)
                            }}
                        >
                            <div className="cursor-pointer border-none bg-white text-sm  ">More Info and QR code </div>
                            <img
                                style={{
                                    transform: isDropdownOpen ? 'scaleY(-1)' : 'none',
                                    transition: 'transform 0.3s ease-in-out',
                                }}
                                src={dropdown_svg.src}
                                alt=""
                                className={'h-6 '}
                            />
                        </div>
                    ) : !copiedAll ? (
                        <div className="text-m border-none bg-white ">
                            Click{' '}
                            <span
                                className="cursor-pointer text-black underline"
                                onClick={() => {
                                    navigator.clipboard.writeText(claimLink.join('\n'))
                                    setCopiedAll(true)
                                }}
                            >
                                here
                            </span>{' '}
                            to copy all links{' '}
                        </div>
                    ) : (
                        <div className="text-m border-none bg-white ">Copied all links to clipboard!</div>
                    )}
                </div>

                {isDropdownOpen && (
                    <div>
                        <div className="h-42 w-42 mx-auto mb-6 mt-4">
                            <div
                                style={{
                                    height: 'auto',
                                    margin: '0 auto',
                                    maxWidth: 192,
                                    width: '100%',
                                }}
                            >
                                <QRCode
                                    size={256}
                                    style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                                    value={claimLink[0]}
                                    viewBox={`0 0 256 256`}
                                />
                            </div>
                        </div>
                        <p className="tx-sm">
                            <a
                                href={explorerUrlWithTx ?? ''}
                                target="_blank"
                                className="cursor-pointer text-center text-sm text-black underline "
                            >
                                Your transaction hash
                            </a>
                        </p>
                        <p className="text-m mt-4" id="to_address-description">
                            {' '}
                            Want to do it again? click{' '}
                            <a
                                onClick={() => {
                                    onCustomScreen('INITIAL')
                                }}
                                target="_blank"
                                className="cursor-pointer text-black underline"
                            >
                                here
                            </a>{' '}
                            to go back home!
                        </p>
                    </div>
                )}
            </div>

            <global_components.PeanutMan type="presenting" />
        </>
    )
}
