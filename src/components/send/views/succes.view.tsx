import { useMemo, useState } from 'react'
import QRCode from 'react-qr-code'

import dropdown_svg from '@/assets/dropdown.svg'

import * as _consts from '../send.consts'
import { useAtom } from 'jotai'
import * as store from '@/store/store'
import * as global_components from '@/components/global'

export function SendSuccessView({ onCustomScreen, claimLink, txReceipt, chainId }: _consts.ISendScreenProps) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [isCopied, setIsCopied] = useState(false)

    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)

    const explorerUrlWithTx = useMemo(
        () => chainDetails.find((detail) => detail.chainId === chainId)?.explorers[0].url + '/tx/' + txReceipt?.hash,
        [txReceipt, chainId]
    )

    return (
        <>
            <div className="flex w-full flex-col items-center text-center ">
                <h2 className="title-font text-5xl font-black text-black">Yay!</h2>
                <p className="mt-2 self-center text-lg">Send this link to your friend so they can claim their funds.</p>
                {typeof claimLink === 'string' && (
                    <div className="brutalborder relative mt-4 flex w-4/5 items-center bg-black py-2 text-white ">
                        <div className="flex w-[90%] items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all bg-black p-2 text-lg text-white">
                            {claimLink}
                        </div>
                        <div
                            className="min-w-32 absolute right-0 top-0 flex h-full cursor-pointer items-center justify-center border-none bg-white px-1 text-black md:px-4"
                            onClick={() => {
                                navigator.clipboard.writeText(claimLink)
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
                )}

                {typeof claimLink === 'string' && (
                    <div
                        className="mt-2 flex cursor-pointer items-center justify-center"
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
                )}

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
                                    value={typeof claimLink === 'string' ? claimLink : ''}
                                    viewBox={`0 0 256 256`}
                                />
                            </div>
                        </div>
                        <p className="tx-sm">
                            <a
                                href={explorerUrlWithTx ?? ''}
                                className="cursor-pointer text-center text-sm text-black underline "
                            >
                                Your transaction hash
                            </a>
                        </p>
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
                        className="cursor-pointer text-black underline"
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
                        className="cursor-pointer text-black underline"
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
