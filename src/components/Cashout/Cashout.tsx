'use client'
import { createElement, useState } from 'react'
import * as _consts from './Cashout.consts'

export const Cashout = ({}) => {
    const [step, setStep] = useState<_consts.ICashoutScreenState>(_consts.INIT_VIEW_STATE)

    const handleOnNext = () => {
        if (step.idx === _consts.CASHOUT_SCREEN_FLOW.length - 1) return
        const newIdx = step.idx + 1
        setStep(() => ({
            screen: _consts.CASHOUT_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
    }
    const handleOnPrev = () => {
        if (step.idx === 0) return
        const newIdx = step.idx - 1
        setStep(() => ({
            screen: _consts.CASHOUT_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
    }
    const handleOnCustom = (screen: _consts.CashoutScreens) => {
        setStep(() => ({
            screen: screen,
            idx: _consts.CASHOUT_SCREEN_FLOW.indexOf(screen),
        }))
    }

    return (
        <div className="card">
            {createElement(_consts.CREATE_SCREEN_MAP[step.screen].comp, {
                onPrev: handleOnPrev,
                onNext: handleOnNext,
                onCustom: handleOnCustom,
            } as _consts.ICashoutScreenProps)}
        </div>
    )
}
