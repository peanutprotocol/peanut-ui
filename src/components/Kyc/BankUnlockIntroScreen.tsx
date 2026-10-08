'use client'

import { DialogTitle } from '@headlessui/react'
import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import Modal from '@/components/Global/Modal'
import SetupFooter from '@/components/Setup/components/SetupFooter'
import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import { acquireBottomNavHide } from '@/utils/bottom-nav-visibility'

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
            classWrap="min-h-dvh max-w-none self-start rounded-none pt-safe-top pb-safe-bottom sm:m-0 sm:self-start"
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
