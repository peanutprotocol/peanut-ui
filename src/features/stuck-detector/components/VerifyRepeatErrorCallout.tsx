'use client'

import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import { useModalsContextOptional } from '@/context/ModalsContext'

export type VerifyRepeatFieldKind = 'taxId' | 'phone' | 'other'

interface VerifyRepeatErrorCalloutProps {
    fieldKey: string
    fieldKind: VerifyRepeatFieldKind
}

const HINT_KEY_BY_KIND: Record<
    VerifyRepeatFieldKind,
    'inline.verifyFormatHint' | 'inline.verifyPhoneHint' | 'inline.verifyGenericHint'
> = {
    taxId: 'inline.verifyFormatHint',
    phone: 'inline.verifyPhoneHint',
    other: 'inline.verifyGenericHint',
}

/**
 * Inline escalation shown on `QuestionStepScreen` after a second consecutive invalid blur
 * on the same verification field. Lives in `stuck-detector` so all proactive help copy and
 * support handoff stay owned by one feature.
 */
export function VerifyRepeatErrorCallout({ fieldKey, fieldKind }: VerifyRepeatErrorCalloutProps) {
    const tBuddy = useTranslations('stuckBuddy')
    const tCommon = useTranslations('common')
    const modals = useModalsContextOptional()

    return (
        <Callout
            priority="info"
            className="w-full text-left"
            data-testid="verify-repeat-error-help"
            ctas={
                modals
                    ? [
                          {
                              label: tCommon('contactSupport'),
                              onClick: () =>
                                  modals.openSupportWithMessage(`${tBuddy('supportTopics.verifyLoop')} (${fieldKey})`),
                          },
                      ]
                    : undefined
            }
        >
            {tBuddy(HINT_KEY_BY_KIND[fieldKind])}
        </Callout>
    )
}
