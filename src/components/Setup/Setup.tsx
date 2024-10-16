'use client'
import { createElement, useEffect, useState } from 'react'
import * as _consts from './Setup.consts'

export const Setup = ({}) => {
    const [step, setStep] = useState<_consts.ISetupViewState>(_consts.INIT_VIEW_STATE)
    return (
        <>
            {createElement(_consts.SETUP_VIEW_MAP[step.screen as keyof typeof _consts.SETUP_VIEW_MAP].comp, {} as any)}
        </>
    )
}