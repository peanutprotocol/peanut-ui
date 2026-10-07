'use client'

import type { ReactNode } from 'react'
import { BankUnlockIntro } from './BankUnlockIntroScreen'
import { useBankUnlockIntro } from '@/hooks/useBankUnlockIntro'

/**
 * Both entry points share an account-scoped device flag. Only a fresh,
 * available unlock shows the benefit; pending/retry/restricted flows keep
 * their existing status or recovery content. Continue never starts the SDK.
 */
export function BankUnlockIntroGate({
    visible,
    enabled = true,
    onClose,
    children,
}: {
    visible: boolean
    enabled?: boolean
    onClose: () => void
    children: ReactNode
}) {
    const { pending, showIntro, finish } = useBankUnlockIntro(visible, enabled)
    // Resolve this account's stored choice before showing either screen.
    if (pending) return null
    if (showIntro)
        return (
            <BankUnlockIntro
                onContinue={finish}
                onBack={() => {
                    finish()
                    onClose()
                }}
            />
        )
    return children
}
