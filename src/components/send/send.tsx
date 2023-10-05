import { createElement, useState } from 'react'
import * as global_components from '@/components/global'
import * as _consts from './send.consts'
import code_snippet from '@/assets/code_snippet.png'

export function Send() {
    const [sendScreen, setSendScreen] = useState<_consts.ISendScreenState>(_consts.INIT_VIEW)
    const [claimLink, setClaimLink] = useState<string | string[]>('')
    const [txHash, setTxHash] = useState<string>('')
    const [chainId, setChainId] = useState<number>(0)

    const handleOnNext = () => {
        const newIdx = sendScreen.idx + 1
        setSendScreen(() => ({
            screen: _consts.SEND_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
    }

    const handleOnCustom = (screen: _consts.SendScreens) => {
        setSendScreen(() => ({
            screen: screen,
            idx: _consts.SEND_SCREEN_FLOW.indexOf(screen),
        }))
    }

    return (
        <>
            <global_components.CardWrapper mt=" mt-16 " shadow>
                {createElement(_consts.SEND_SCREEN_MAP[sendScreen.screen].comp, {
                    onNextScreen: handleOnNext,
                    onCustomScreen: handleOnCustom,
                    claimLink,
                    setClaimLink,
                    txHash,
                    setTxHash,
                    chainId,
                    setChainId,
                } as _consts.ISendScreenProps)}
            </global_components.CardWrapper>
            {/* {sendScreen == _consts.INIT_VIEW && (
                <global_components.CardWrapper mb=" mb-8">
                    <div className="mt-2 text-center text-black">
                        <h2 className="title-font text-3xl font-black text-black lg:text-5xl">
                            Integrate Peanut Protocol
                        </h2>

                        <div className="mx-auto w-11/12 pb-8 lg:w-2/3">
                            Want the peanut magic in your own dApp? Just install our{' '}
                            <a
                                href="https://www.npmjs.com/package/@squirrel-labs/peanut-sdk"
                                className="text-black underline"
                            >
                                npm
                            </a>{' '}
                            library, and with 2 lines of code, you can create token links to send any type of tokens or
                            NFTs!
                        </div>
                        <img src={code_snippet.src} className="mx-auto w-11/12 lg:w-2/3" />

                        <div className="mx-auto w-11/12 pt-8 lg:w-2/3">
                            Read more{' '}
                            <a
                                href="https://peanutprotocol.gitbook.io/peanut-protocol-docs-1/overview/what-we-do"
                                target="_blank"
                                className="text-black underline"
                            >
                                here
                            </a>
                        </div>
                    </div>
                </global_components.CardWrapper>
            )} */}
        </>
    )
}
