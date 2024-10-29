'use client'

import { createElement } from 'react'
import * as _consts from './Setup.consts'
import { HandleSetupView } from './Views'

export const Setup = ({}) => {
    return <>{createElement(HandleSetupView, {} as any)}</>
}
