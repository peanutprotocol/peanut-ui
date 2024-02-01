import { useState } from 'react'

import peanutman_redpacket from '@/assets/peanutman-redpacket.svg'
import * as global_components from '@/components/global'
import * as _consts from '../send.consts'

export function SendSuccessView({ claimLink }: _consts.ISendScreenProps) {
    const [isCopied, setIsCopied] = useState(false)

    return (
        <>
            <div className="mb-4 mt-10 flex w-full flex-col items-center gap-6 text-center ">
                <h2 className="title-font bold my-0 text-2xl lg:text-4xl">Yay!</h2>
                <img src={peanutman_redpacket.src} className="h-auto w-3/4 max-w-[264px]" />
                <p className="my-0 self-center text-lg font-normal">
                    Send your red packet link to your friend group chat!{' '}
                </p>

                <div className="brutalborder relative flex w-4/5 items-center bg-black py-1 text-white ">
                    <div className="flex w-[100%] items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all bg-black p-2 text-lg font-normal text-white">
                        {claimLink}
                    </div>
                </div>

                <button
                    type={'button'}
                    className="mt-2 block w-[90%] cursor-pointer bg-white p-5 px-2  text-2xl font-black sm:w-2/5 lg:w-1/2"
                    id="cta-btn"
                    onClick={() => {
                        navigator.clipboard.writeText(claimLink[0])
                        setIsCopied(true)
                    }}
                >
                    {isCopied ? 'Copied!' : 'Copy'}
                </button>
                <global_components.socialsComponent />
            </div>

            <global_components.PeanutMan type="redpacket" />
        </>
    )
}
