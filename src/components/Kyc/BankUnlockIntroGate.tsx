'use client'

import { DialogTitle } from '@headlessui/react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import Modal from '@/components/Global/Modal'
import SetupFooter from '@/components/Setup/components/SetupFooter'
import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import { useAuth } from '@/context/authContext'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useKycDegraded } from '@/hooks/useKycDegraded'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import { acquireBottomNavHide } from '@/utils/bottom-nav-visibility'

// Storage may be unavailable in a WebView. Still remember the introduction
// between the Home and menu entry points for the lifetime of this session.
const seenWithoutStorage = new Set<string>()
const storageKey = (userId: string) => `peanut_bank_unlock_intro_seen:${userId}`

/** The retired signup benefit screen, before a user's first bank unlock. */
export function BankUnlockIntro({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
    const t = useTranslations('setup')
    const tCommon = useTranslations('common')
    useEffect(() => acquireBottomNavHide(), [])

    return (
        <Modal
            visible
            onClose={onBack}
            hideOverlay
            className="z-40 !p-0"
            classWrap="min-h-dvh max-w-none self-start rounded-none pt-[var(--safe-top)] pb-[var(--safe-bottom)] sm:m-0 sm:self-start"
        >
            <DialogTitle className="sr-only">{t('steps.advantage-bank.title')}</DialogTitle>
            <SetupWrapper
                layoutType="signup"
                screenId="advantage-bank"
                image={{ animation: 'bank' }}
                title={t('steps.advantage-bank.title')}
                description={t('steps.advantage-bank.description')}
                showBackButton
                showProgress={false}
                onBack={onBack}
            >
                <SetupFooter
                    actions={
                        <Button size="medium" className="w-full" shadowSize="4" onClick={onContinue}>
                            {tCommon('continue')}
                        </Button>
                    }
                />
            </SetupWrapper>
        </Modal>
    )
}

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
    const { user } = useAuth()
    const { status, isLoading } = useIdentityVerification()
    const { banking } = useResidenceRestrictions()
    const degraded = useKycDegraded()
    const userId = user?.user?.userId
    const eligible = enabled && !!userId && !isLoading && status === 'not_started' && !banking && !degraded
    const [checked, setChecked] = useState<{ userId: string; seen: boolean } | null>(null)

    useEffect(() => {
        if (!visible || !eligible || !userId) return
        let seen = seenWithoutStorage.has(userId)
        try {
            seen = seen || localStorage.getItem(storageKey(userId)) === '1'
        } catch {}
        setChecked({ userId, seen })
    }, [visible, eligible, userId])

    const finish = () => {
        if (!userId) return
        try {
            localStorage.setItem(storageKey(userId), '1')
        } catch {
            seenWithoutStorage.add(userId)
        }
        setChecked({ userId, seen: true })
    }

    if (visible && eligible) {
        // Wait for this account's stored choice, without flashing the next
        // screen during hydration or reusing a previous account's choice.
        if (checked?.userId !== userId) return null
        if (!checked.seen)
            return (
                <BankUnlockIntro
                    onContinue={finish}
                    onBack={() => {
                        finish()
                        onClose()
                    }}
                />
            )
    }
    return children
}
