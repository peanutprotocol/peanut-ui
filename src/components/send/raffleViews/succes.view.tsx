import { useState } from 'react'
import { isMobile } from 'react-device-detect'
import { Tooltip } from 'react-tooltip'

import peanutman_cheering from '@/assets/peanut/peanutman-cheering.png'
import clipboard_svg from '@/assets/icons/clipboard.svg'
import * as global_components from '@/components/global'
import * as _consts from '../send.consts'

export function RaffleSuccessView({ claimLink, onCustomScreen }: _consts.ISendScreenProps) {
    const [isCopied, setIsCopied] = useState(false)

    return (
        <>
            <div className="mb-4 mt-10 flex w-full flex-col items-center gap-6 text-center ">
                <h2 className=" bold my-0 text-2xl lg:text-4xl">Yay!</h2>
                <img src={peanutman_cheering.src} className="h-auto w-3/4 max-w-[264px]" />
                <p className="my-0 self-center text-lg font-normal">
                    Send your raffle link to your friend group chat!{' '}
                </p>

                <div
                    className="brutalborder relative flex w-4/5 cursor-pointer items-center bg-black py-1 text-white "
                    onClick={() => {
                        navigator.clipboard.writeText(claimLink[0])
                        setIsCopied(true)
                    }}
                >
                    <div className="flex w-[100%] items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all bg-black p-2 text-lg font-normal text-white">
                        {claimLink}
                    </div>

                    {isMobile ? (
                        <div
                            className="absolute right-0 top-0 flex h-full min-w-12 cursor-pointer items-center justify-center border-none bg-white px-1 text-black md:px-4"
                            onClick={() => {
                                navigator.clipboard.writeText(claimLink[0])
                                setIsCopied(true)
                            }}
                            data-tooltip-id="my-tooltip"
                        >
                            <Tooltip
                                id="my-tooltip"
                                className="bg-black !opacity-100 "
                                style={{
                                    backgroundColor: 'black',
                                    borderRadius: '0px',
                                    border: '2px solid black',
                                }}
                            >
                                <span className="tooltiptext inline w-full justify-center" id="myTooltip">
                                    {' '}
                                    copied!{' '}
                                </span>
                            </Tooltip>
                            <button className="h-full cursor-pointer gap-2 border-none bg-white pt-2 text-base font-bold ">
                                <img src={clipboard_svg.src} className="h-8 w-8 " />
                            </button>
                        </div>
                    ) : (
                        <div
                            className="absolute right-0 top-0 flex h-full min-w-32 cursor-pointer items-center justify-center border-none bg-white px-1 text-black md:px-4"
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
                    )}
                </div>

                <button
                    type={'button'}
                    className="mt-2 block w-[90%] cursor-pointer bg-white p-5 px-2  text-2xl font-black sm:w-2/5 lg:w-1/2"
                    id="cta-btn"
                    onClick={() => {
                        onCustomScreen('INITIAL')
                    }}
                >
                    Create
                </button>
                <global_components.socialsComponent message={`Here is a Raffle for you! ${claimLink[0]}`} />
            </div>
        </>
    )
}
