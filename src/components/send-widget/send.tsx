import { createElement, useState } from 'react'
import * as global_components from '@/components/global'
import * as _consts from './send.consts'
import code_snippet from '@/assets/code_snippet.png'
import {IBranding} from "./send.consts";
export function SendWidget({ branding }: {branding?: IBranding}) {
    const [sendScreen, setSendScreen] = useState<_consts.ISendScreenState>(_consts.INIT_VIEW)
    const [claimLink, setClaimLink] = useState<string>('')
    const [txReceipt, setTxReceipt] = useState<string>('')
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
        <div className="h-full">
            {
                createElement(_consts.SEND_SCREEN_MAP[sendScreen.screen].comp, {
                    onNextScreen: handleOnNext,
                    onCustomScreen: handleOnCustom,
                    claimLink,
                    setClaimLink,
                    branding,
                    txReceipt,
                    setTxReceipt,
                    chainId,
                    setChainId,
                } as _consts.ISendScreenProps)
            }
        </div>
    )
}
