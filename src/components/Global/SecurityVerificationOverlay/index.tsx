'use client'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { useTranslations } from 'next-intl'
import { useModalsContext } from '@/context/ModalsContext'

/**
 * Full-screen security-verification overlay. Mounted globally; visibility
 * is driven by `isSecurityVerificationOpen` in ModalsContext.
 *
 * Use case: the mixed card-withdraw flow signs an admin EIP-712 (tap #1)
 * then sends a UserOp (tap #2). Between the two passkey prompts there's a
 * short — but visible — gap while the kernel prepares the follow-up op.
 * This overlay gives the user something to look at and confirms the app
 * is actively working, even when the gap is fast.
 *
 * Reusable: any flow that wants the same "Verifying security…" beat can
 * toggle the state via `setIsSecurityVerificationOpen`.
 */
export default function SecurityVerificationOverlay() {
    const t = useTranslations('global')
    const { isSecurityVerificationOpen } = useModalsContext()
    if (!isSecurityVerificationOpen) return null
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background"
            role="status"
            aria-live="polite"
        >
            <PeanutLoading message={t('securityVerificationOverlay.message')} />
        </div>
    )
}
