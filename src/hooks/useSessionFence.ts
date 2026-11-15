'use client'

import { useCallback, useEffect, useRef } from 'react'
import { captureSessionFence } from '@/utils/session-fence'
import { useOptionalAuth } from '@/context/authContext'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useTranslations } from 'next-intl'
export type { SessionFence } from '@/utils/session-fence'

/** Bind an asynchronous intent to its authenticated account and mounted owner. */
export function useSessionFence() {
    const userId = useOptionalAuth()?.user?.user.userId
    const latestUserId = useRef(userId)
    latestUserId.current = userId
    const toast = useToast()
    const t = useTranslations('kyc.paperworkVerification.errors')
    const lifetime = useRef(0)
    useEffect(
        () => () => {
            lifetime.current += 1
        },
        []
    )
    return useCallback(() => {
        const owner = lifetime.current
        const account = latestUserId.current
        const fence = captureSessionFence(
            account,
            () => lifetime.current === owner && latestUserId.current === account,
            () => toast.error(t('unavailable'))
        )
        if (!fence.current()) toast.error(t('unavailable'))
        return fence
    }, [toast, t])
}
