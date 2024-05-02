'use client'

import { createElement, useState } from 'react'

import * as _consts from './Create.consts'

export const Create = ({ type }: { type: _consts.CreateType }) => {
    const [step, setStep] = useState<_consts.ICreateScreenState>(_consts.INIT_VIEW_STATE)
    const [legacyStep, setLegacyStep] = useState<_consts.ICreateScreenStateLegacy>(_consts.INIT_VIEW_STATE_LEGACY)

    const handleOnNext = (type: 'normal' | 'legacy') => {
        if (type === 'legacy') {
            if (legacyStep.idx === _consts.CREATE_SCREEN_LEGACY_FLOW.length - 1) return
            const newIdx = legacyStep.idx + 1
            setLegacyStep(() => ({
                screen: _consts.CREATE_SCREEN_LEGACY_FLOW[newIdx],
                idx: newIdx,
            }))
        } else if (type === 'normal') {
            if (step.idx === _consts.CREATE_SCREEN_FLOW.length - 1) return
            const newIdx = step.idx + 1
            setStep(() => ({
                screen: _consts.CREATE_SCREEN_FLOW[newIdx],
                idx: newIdx,
            }))
        }
    }

    const handleOnPrev = (type: 'normal' | 'legacy') => {
        if (type === 'legacy') {
            if (legacyStep.idx === 0) return
            const newIdx = legacyStep.idx - 1
            setLegacyStep(() => ({
                screen: _consts.CREATE_SCREEN_LEGACY_FLOW[newIdx],
                idx: newIdx,
            }))
        } else if (type === 'normal') {
            if (step.idx === 0) return
            const newIdx = step.idx - 1
            setStep(() => ({
                screen: _consts.CREATE_SCREEN_FLOW[newIdx],
                idx: newIdx,
            }))
        }
    }
    return (
        <div className="card">
            {type === 'normal' &&
                createElement(_consts.CREATE_SCREEN_MAP[step.screen].comp, {
                    onPrev: handleOnPrev,
                    onNext: handleOnNext,
                } as _consts.ICreateScreenProps)}
            {type === 'batch' &&
                createElement(_consts.BATCH_CREATE_SCREEN_MAP[legacyStep.screen].comp, {
                    onPrev: handleOnPrev,
                    onNext: handleOnNext,
                } as _consts.ICreateScreenProps)}
            {type === 'raffle' &&
                createElement(_consts.RAFFLE_CREATE_SCREEN_MAP[legacyStep.screen].comp, {
                    onPrev: handleOnPrev,
                    onNext: handleOnNext,
                } as _consts.ICreateScreenProps)}
        </div>
    )
}
