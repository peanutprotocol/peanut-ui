import { useMemo, useState } from 'react'
import QRCode from 'react-qr-code'

import dropdown_svg from '@/assets/dropdown.svg'

import * as _consts from '../send.consts'
import { useAtom } from 'jotai'
import * as store from '@/store/store'
import * as global_components from '@/components/global'
import { useSearchParams } from 'next/navigation'
import {useBranding} from "../hooks";

export function SendSuccessView({ onCustomScreen, claimLink, txReceipt, chainId }: _consts.ISendScreenProps) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [isCopied, setIsCopied] = useState(false)

    const searchParams = useSearchParams();
    const branding = useBranding(searchParams);

    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)

    const explorerUrlWithTx = useMemo(
        () => chainDetails.find((detail) => detail.chainId === chainId)?.explorers[0].url + '/tx/' + txReceipt?.transactionHash,
        [txReceipt, chainId]
    )

    return (
        <>
            <div className="flex w-full flex-col items-center text-center" style={{backgroundColor: branding.backgroundColor, color: branding.textColor}}>
                <h2 className="title-font text-5xl font-black text-black" style={{color: branding.titleTextColor}}>Yay!</h2>
                <p className="mt-2 self-center text-lg">Send this link to your friend so they can claim their funds.</p>
                <div className="brutalborder relative mt-4 flex w-4/5 items-center bg-black py-2 text-white" style={{borderColor: branding.boxTextColor, backgroundColor: branding.boxBackgroundColor}}>
                    <div className="flex w-[90%] items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all bg-black p-2 text-lg text-white border-1" style={{backgroundColor: branding.boxBackgroundColor, color: branding.boxTextColor}}>
                        {claimLink}
                    </div>
                    <div
                        className="min-w-32 absolute right-0 top-0 flex h-full cursor-pointer items-center justify-center border-none bg-white px-1 text-black md:px-4" style={{backgroundColor: branding.boxTextColor}}
                        onClick={() => {
                            navigator.clipboard.writeText(claimLink)
                            setIsCopied(true)
                        }}
                    >
                        {isCopied ? (
                            <div className="flex h-full cursor-pointer items-center border-none text-base font-bold ">
                                <span className="tooltiptext inline w-full justify-center" id="myTooltip" style={{color: branding.boxBackgroundColor}}>
                                    {' '}
                                    copied!{' '}
                                </span>
                            </div>
                        ) : (
                            <button className="h-full cursor-pointer gap-2 border-none bg-transparent p-0 text-base font-bold " style={{color: branding.boxTextColor}}>
                                <label style={{color: branding.boxBackgroundColor}} className="cursor-pointer text-black">COPY</label>
                            </button>
                        )}
                    </div>
                </div>

                <div
                    className="mt-2 flex cursor-pointer items-center justify-center"
                    onClick={() => {
                        setIsDropdownOpen(!isDropdownOpen)
                    }}
                >
                    <div className="cursor-pointer border-none text-sm  ">More Info and QR code </div>
                    <svg className="svg-icon" style={{width: '1em', height: '1em', verticalAlign: 'middle', fill: 'currentColor',overflow: 'hidden'}}
                        viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
                        <path
                            d="M680.1408 414.976c9.9328-8.704 24.2176-6.656 31.8976 4.608a27.8016 27.8016 0 0 1-4.096 35.84l-172.032 149.76a35.6352 35.6352 0 0 1-47.8208 0l-172.032-149.7088a27.8016 27.8016 0 0 1-4.096-35.9424c7.68-11.1616 22.016-13.2096 31.8976-4.608L512 561.3056l168.1408-146.2784z"/>
                    </svg>
                </div>
                {isDropdownOpen && (
                    <div>
                        <div className="h-42 w-42 mx-auto mb-6 mt-4 p-2 bg-white">
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
                                    value={claimLink}
                                    viewBox={`0 0 256 256`}
                                />
                            </div>
                        </div>
                        <p className="tx-sm">
                            <a
                                href={explorerUrlWithTx ?? ''}
                                className="cursor-pointer text-center text-sm underline "
                                style={{color: branding.textColor}}
                            >
                                Your transaction hash
                            </a>
                        </p>

                        {/* <p className="mt-4">
          If you input an email address, we'll send them the link there too!
        </p> whats this? */}
                    </div>
                )}

                <p className="text-m mt-4" id="to_address-description">
                    {' '}
                    Want to do it again? click{' '}
                    <a
                        onClick={() => {
                            onCustomScreen('INITIAL')
                        }}
                        target="_blank"
                        className="cursor-pointer underline"
                    >
                        here
                    </a>{' '}
                    to go back home!
                </p>

                <p className="mt-4 text-xs" id="to_address-description">
                    {' '}
                    Thoughts? Feedback? Use cases? Memes? Hit us up on{' '}
                    <a
                        href="https://discord.gg/BX9Ak7AW28"
                        target="_blank"
                        className="cursor-pointer underline"
                        style={{color: branding.textColor}}
                    >
                        Discord
                    </a>
                    !
                </p>
            </div>

            <global_components.PeanutMan type="presenting" />
        </>
    )
}
