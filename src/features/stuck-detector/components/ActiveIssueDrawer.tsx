'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { twMerge } from '@/utils/tw'
import type { BugReportCategory } from '../types'
import { StuckDrawerShell } from './StuckDrawerShell'

interface ActiveIssueDrawerProps {
    open: boolean
    onClose: () => void
    onContactSupport: (topic: string, copyContext?: string) => void
    onSubmitBugReport: (category: BugReportCategory, note: string) => void
}

const BUG_CATEGORIES: readonly { id: BugReportCategory; labelKey: string }[] = [
    { id: 'payment_failed', labelKey: 'bugCategories.paymentFailed' },
    { id: 'screen_stuck', labelKey: 'bugCategories.screenStuck' },
    { id: 'something_wrong', labelKey: 'bugCategories.somethingWrong' },
]

export function ActiveIssueDrawer({ open, onClose, onContactSupport, onSubmitBugReport }: ActiveIssueDrawerProps) {
    const t = useTranslations('stuckBuddy')
    const tCommon = useTranslations('common')

    const [selectedCategory, setSelectedCategory] = useState<BugReportCategory>('payment_failed')
    const [note, setNote] = useState('')
    const [bugSent, setBugSent] = useState(false)

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            setBugSent(false)
            setNote('')
            onClose()
        }
    }

    const handleSendBug = () => {
        onSubmitBugReport(selectedCategory, note.trim())
        setBugSent(true)
    }

    if (bugSent) {
        return (
            <StuckDrawerShell
                open={open}
                onOpenChange={handleOpenChange}
                icon="check"
                iconColor="green"
                title={t('drawers.bugSent.title')}
                description={t('drawers.bugSent.description')}
                testId="stuck-drawer-active_issue"
            >
                <Button
                    className="w-full justify-center"
                    onClick={() => handleOpenChange(false)}
                    data-testid="stuck-bug-done"
                >
                    {tCommon('done')}
                </Button>
            </StuckDrawerShell>
        )
    }

    return (
        <StuckDrawerShell
            open={open}
            onOpenChange={handleOpenChange}
            icon="info"
            iconColor="blue"
            title={t('drawers.activeIssue.title')}
            description={t('drawers.activeIssue.description')}
            testId="stuck-drawer-active_issue"
        >
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('drawers.activeIssue.categoryLabel')}>
                {BUG_CATEGORIES.map((category) => {
                    const selected = selectedCategory === category.id
                    return (
                        <button
                            key={category.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setSelectedCategory(category.id)}
                            data-testid={`bug-chip-${category.id}`}
                            className={twMerge(
                                'min-h-11 rounded-sm border px-3 py-2 text-body-s-semibold transition-colors duration-instant focus-visible:outline-3 focus-visible:outline-action-focus',
                                selected
                                    ? 'border-action-focus bg-background-selection text-foreground-primary'
                                    : 'border-border-default bg-background-default text-foreground-primary'
                            )}
                        >
                            {t(category.labelKey as Parameters<typeof t>[0])}
                        </button>
                    )
                })}
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor="stuck-bug-note" className="text-label-l text-foreground-primary">
                    {t('drawers.activeIssue.noteLabel')}
                </label>
                <input
                    id="stuck-bug-note"
                    type="text"
                    maxLength={160}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t('drawers.activeIssue.notePlaceholder')}
                    className="input h-12 w-full"
                />
            </div>

            <div className="flex w-full flex-col items-center gap-4 pt-1">
                <Button className="w-full justify-center" onClick={handleSendBug} data-testid="stuck-bug-submit">
                    {t('drawers.activeIssue.submitCta')}
                </Button>
                <Button
                    variant="secondary"
                    className="w-full justify-center"
                    onClick={() => {
                        onContactSupport(t('supportTopics.activeIssue'), t('drawers.activeIssue.copyMessage'))
                        handleOpenChange(false)
                    }}
                    data-testid="stuck-drawer-support"
                >
                    {tCommon('contactSupport')}
                </Button>
                <div className="mt-2">
                    <LinkButton onClick={() => handleOpenChange(false)}>{tCommon('maybeLater')}</LinkButton>
                </div>
            </div>
        </StuckDrawerShell>
    )
}
