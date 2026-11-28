'use client'

import type { MouseEvent } from 'react'
import { useTranslations } from 'next-intl'
import { useModalsContextOptional } from '@/context/ModalsContext'

export const SETUP_SUPPORT_FALLBACK_URL = 'https://peanut.me/support'

export type SetupSupportTopic =
    | { key: 'setupPasskey' }
    | { key: 'loginRecovery' }
    | { key: 'usernameCheck' }
    | { key: 'passkeyError'; errorName: string }

/**
 * Keeps `/setup` support links inside the app by opening the mounted `<SupportDrawer />`
 * (which works pre-login on both web and native) with a localized support topic whenever
 * `ModalsContext` is present, falling back to `https://peanut.me/support` only standalone.
 */
export function useSetupSupportClick(topic: SetupSupportTopic, onSupport?: () => void) {
    const modals = useModalsContextOptional()
    const tTopics = useTranslations('stuckBuddy.supportTopics')

    const resolveTopic = () => {
        if (topic.key === 'passkeyError') {
            return tTopics('passkeyError', { errorName: topic.errorName })
        }
        return tTopics(topic.key)
    }

    return {
        /** `undefined` when ModalsContext is present so `<LinkButton>` renders an in-app button instead of an external anchor. */
        href: modals ? undefined : SETUP_SUPPORT_FALLBACK_URL,
        onClick: (event?: MouseEvent) => {
            onSupport?.()
            if (modals) {
                event?.preventDefault()
                modals.openSupportWithMessage(resolveTopic())
            }
        },
    }
}
