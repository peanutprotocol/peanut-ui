import { useMemo, useState } from 'react'
import QRCode from 'react-qr-code'

import dropdown_svg from '@/assets/dropdown.svg'

import * as _consts from '../send.consts'
import { useAtom } from 'jotai'
import * as store from '@/store/store'
import * as global_components from '@/components/global'
import { useSearchParams } from 'next/navigation'
import {useBranding} from "../hooks";
import peanut48 from '@/assets/peanut-48.png'

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
            <div className="flex w-full h-full flex-col items-center text-center" style={{backgroundColor: branding.backgroundColor, color: branding.textColor}}>
                <div style={{fontSize: 10}} className="text-xs p-0.5 text-center">
                    <span>Powered by</span><img className="w-3 mx-1 align-middle" src={peanut48.src} alt="logo"/><span>Peanut</span>
                </div>
                {/*<h2 className="hidden sm:block title-font text-5xl font-black text-black my-4" style={{color: branding.titleTextColor}}>Yay!</h2>*/}
                <p className="mt-1 px-2 mb-0 widget:my-4 self-center text-lg">Send this link to your friend so they can claim their funds.</p>

                {!isDropdownOpen ? (
                    <>
                    <div className="hidden widget:flex brutalborder relative mt-4 flex w-4/5 items-center bg-black py-2 text-white" style={{borderColor: branding.boxTextColor, backgroundColor: branding.boxBackgroundColor}}>
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
                                <button className="h-full cursor-pointer gap-2 border-none bg-transparent p-0 text-base font-bold px-2" style={{color: branding.boxTextColor}}>
                                    <label style={{color: branding.boxBackgroundColor}} className="cursor-pointer text-black">COPY</label>
                                </button>
                            )}
                        </div>
                    </div>
                    <div
                        className="hidden widget:flex mt-2 flex cursor-pointer items-center justify-center"
                        onClick={() => {
                            setIsDropdownOpen(!isDropdownOpen)
                        }}
                    >
                        <div className="cursor-pointer border-none text-sm  ">click to see QR code</div>
                    </div>
                    </>
                ) : (
                    <div className="hidden widget:block">
                        <div className="h-42 w-42 mx-auto mb-2 mt-2 p-2 bg-white">
                            <div
                                style={{
                                    height: 'auto',
                                    margin: '0 auto',
                                    maxWidth: 192,
                                    width: '100%',
                                }}
                            >
                                <QRCode
                                    size={120}
                                    style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                                    value={claimLink}
                                    viewBox={`0 0 256 256`}
                                />
                            </div>
                        </div>
                        <div className="cursor-pointer border-none text-sm" onClick={() => {
                            setIsDropdownOpen(!isDropdownOpen)
                        }}>click to see LINK</div>
                    </div>
                )}

                <div className="block widget:hidden">
                    <div className="h-42 w-42 mx-auto mt-1 p-2 bg-white">
                        <div
                            style={{
                                height: 'auto',
                                margin: '0 auto',
                                maxWidth: 192,
                                width: '100%',
                            }}
                        >
                            <QRCode
                                size={120}
                                style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                                value={claimLink}
                                viewBox={`0 0 256 256`}
                            />
                        </div>
                    </div>
                    <p className="tx-sm widget:hidden" onClick={() => {
                            navigator.clipboard.writeText(claimLink)
                            setIsCopied(true)
                        }}>
                        {isCopied ? (
                            <span>copied!</span>
                        ) : (
                            <label className="cursor-pointer underline">copy link</label>
                        )}
                    </p>
                    <p className="tx-sm hidden widget:inline-block">
                        <a
                            href={explorerUrlWithTx ?? ''}
                            className="cursor-pointer text-center text-sm underline "
                            style={{color: branding.textColor}}
                        >
                            Your transaction hash
                        </a>
                    </p>
                </div>

                <p className="text-m mt-2 widget:mt-6" id="to_address-description">
                    {' '}
                    Want to do it again? <br/>
                    <a
                        onClick={() => {
                            onCustomScreen('INITIAL')
                        }}
                        target="_blank"
                        className="cursor-pointer underline"
                    >
                        click here
                    </a>
                </p>
            </div>

            <global_components.PeanutMan type="presenting" />
        </>
    )
}
