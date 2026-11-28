'use client'

import type { MouseEvent } from 'react'
import { useModalsContextOptional } from '@/context/ModalsContext'

export const SETUP_SUPPORT_FALLBACK_URL = 'https://peanut.me/support'

/**
 * Keeps `/setup` support links inside the app by opening the mounted `<SupportDrawer />`
 * (which works pre-login on both web and native) whenever `ModalsContext` is present,
 * falling back to `https://peanut.me/support` only when rendered standalone without context.
 */
export function useSetupSupportClick(topic: string, onSupport?: () => void) {
    const modals = useModalsContextOptional()
    return {
        /** `undefined` when ModalsContext is present so `<LinkButton>` renders an in-app button instead of an external anchor. */
        href: modals ? undefined : SETUP_SUPPORT_FALLBACK_URL,
        onClick: (event?: MouseEvent) => {
            onSupport?.()
            if (modals) {
                event?.preventDefault()
                modals.openSupportWithMessage(topic)
            }
        },
    }
}
