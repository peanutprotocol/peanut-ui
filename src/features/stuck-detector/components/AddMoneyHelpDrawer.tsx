'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { NumberedList } from '@/components/0_Bruddle/NumberedList'
import { StuckDrawerShell } from './StuckDrawerShell'

interface AddMoneyHelpDrawerProps {
    open: boolean
    onClose: () => void
    onContactSupport: (topic: string, copyContext?: string) => void
}

export function AddMoneyHelpDrawer({ open, onClose, onContactSupport }: AddMoneyHelpDrawerProps) {
    const t = useTranslations('stuckBuddy')
    const tCommon = useTranslations('common')

    return (
        <StuckDrawerShell
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
            icon="question-mark"
            iconColor="blue"
            title={t('drawers.addMoney.title')}
            description={t('drawers.addMoney.description')}
            testId="stuck-drawer-add_money"
        >
            <NumberedList
                items={[t('drawers.addMoney.step1'), t('drawers.addMoney.step2'), t('drawers.addMoney.step3')]}
            />
            <div className="flex w-full flex-col items-center gap-6 pt-2">
                <Button
                    className="w-full justify-center"
                    onClick={() => {
                        onContactSupport(t('supportTopics.addMoney'), t('drawers.addMoney.copyMessage'))
                        onClose()
                    }}
                    data-testid="stuck-drawer-primary"
                >
                    {t('drawers.addMoney.primaryCta')}
                </Button>
                <LinkButton onClick={onClose}>{tCommon('maybeLater')}</LinkButton>
            </div>
        </StuckDrawerShell>
    )
}
