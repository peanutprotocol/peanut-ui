'use client'

import { useTranslations } from 'next-intl'
import ProgressBar from '@/components/0_Bruddle/ProgressBar'
import { useActivationStatus } from '@/hooks/useActivationStatus'
import { checklistProgress } from '@/utils/activation-step.utils'

/** The to-do list under a more critical ask: where the user stands, with nothing to tap. */
export default function TodoSummary() {
    const t = useTranslations('home.gettingStarted')
    const { onboarding } = useActivationStatus()
    const { done, total } = checklistProgress(onboarding)
    return (
        <div className="flex flex-col gap-1" data-testid="todo-summary">
            <span className="text-body-s text-foreground-secondary">{t('progress', { done, total })}</span>
            <ProgressBar value={Math.round((done / total) * 100)} fillClassName="bg-background-icon-bubble-green" />
        </div>
    )
}
