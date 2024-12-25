'use client'

import { createElement } from 'react'
import { HandleSetupView } from './Views'

export const Setup = ({}) => {
    return <>{createElement(HandleSetupView, {} as any)}</>
}
