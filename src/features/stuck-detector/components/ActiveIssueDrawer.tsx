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
    onSubmitBugReport: (category: BugReportCategory, categoryLabel: string, note: string) => void
}

const BUG_CATEGORIES = [
    { id: 'payment_failed', labelKey: 'bugCategories.paymentFailed' },
    { id: 'screen_stuck', labelKey: 'bugCategories.screenStuck' },
    { id: 'something_wrong', labelKey: 'bugCategories.somethingWrong' },
] as const

export function ActiveIssueDrawer({ open, onClose, onSubmitBugReport }: ActiveIssueDrawerProps) {
    const t = useTranslations('stuckBuddy')
    const tCommon = useTranslations('common')

    const [selectedCategory, setSelectedCategory] = useState<BugReportCategory>('payment_failed')
    const [note, setNote] = useState('')

    const handleClose = () => {
        setNote('')
        onClose()
    }

    const handleSendToSupport = () => {
        const picked = BUG_CATEGORIES.find((c) => c.id === selectedCategory) ?? BUG_CATEGORIES[0]
        onSubmitBugReport(selectedCategory, t(picked.labelKey), note.trim())
        handleClose()
    }

    return (
        <StuckDrawerShell
            open={open}
            onClose={handleClose}
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
                            {t(category.labelKey)}
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

            <div className="flex w-full flex-col items-center gap-6 pt-1">
                <Button className="w-full justify-center" onClick={handleSendToSupport} data-testid="stuck-bug-submit">
                    {t('drawers.activeIssue.submitCta')}
                </Button>
                <LinkButton onClick={handleClose}>{tCommon('maybeLater')}</LinkButton>
            </div>
        </StuckDrawerShell>
    )
}
