/**
 * Lazy DaimoPayProvider wrapper.
 * Only includes DaimoPay context for pages that actually use it.
 * Prevents global polling of untronHasAvailableReceivers API.
 */
'use client'
import { DaimoPayProvider } from '@daimo/pay'
import { DAIMO_THEME } from '@/constants/daimo.consts'
import { type ReactNode } from 'react'

interface DaimoPayWrapperProps {
    children: ReactNode
}

export const DaimoPayWrapper = ({ children }: DaimoPayWrapperProps) => {
    return (
        <DaimoPayProvider options={{ embedGoogleFonts: true, disableMobileInjector: true }} customTheme={DAIMO_THEME}>
            {children}
        </DaimoPayProvider>
    )
}

