'use client'

import { type ReactNode, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import { Icon } from '@/components/Global/Icons/Icon'
import SetupTitleBlock from '@/components/Setup/components/SetupTitleBlock'
import type { VerifyOnceFeature, VerifyOnceStep, VerifyOnceStepId } from '@/app/actions/types/kyc-verify-once.types'
import { useAnswerForm, type AnswerFormError } from '../useAnswerForm'
import { stepComplete } from '../verifyOnce.utils'
import { isSentenceField, QuestionFields } from './QuestionFields'
import { VerifyFooter, VerifyQuestionLayout } from './VerifyLayout'

const FORM_ERROR_KEYS: Record<AnswerFormError, string> = {
    retry: 'errors.retry',
    feature_not_selected: 'errors.featureNotSelected',
    identity_submitted: 'errors.identitySubmitted',
    unavailable: 'errors.unavailable',
    existing_verification: 'errors.unavailable',
    conflict: 'errors.retry',
}

function useStepHeading(step: VerifyOnceStep) {
    const t = useTranslations('kyc.verifyOnce')
    if (step.fields.some(isSentenceField)) return null
    if (step.id === 'tax') {
        const ssn = step.fields.find((f) => f.kind === 'taxId')?.format === 'ssn'
        return {
            title: t(ssn ? 'tax.title.ssn' : 'tax.title.other'),
            description: t(ssn ? 'tax.description.ssn' : 'tax.description.other'),
        }
    }
    if (step.id === 'address' || step.id === 'phone' || step.id === 'declarations')
        return { title: t(`titles.${step.id}`), description: t(`descriptions.${step.id}`) }
    return null
}

/** "Why do we ask?": what each answer is for, and that it only reaches the partner that needs it. */
export function WhyWeAsk({ steps }: { steps: VerifyOnceStepId[] }) {
    const t = useTranslations('kyc.verifyOnce')
    const [open, setOpen] = useState(false)
    return (
        <>
            <LinkButton onClick={() => setOpen(true)} data-testid="verify-why">
                {t('whyAsk')}
            </LinkButton>
            <Drawer open={open} onOpenChange={setOpen}>
                <DrawerContent>
                    <div className="flex flex-col gap-4 pb-4">
                        <DrawerTitle>{t('whyTitle')}</DrawerTitle>
                        {steps.map((step) => (
                            <p key={step} className="text-body-s text-foreground-secondary">
                                {t(`why.${step}`)}
                            </p>
                        ))}
                        <p className="text-body-s text-foreground-secondary">{t('whyShared')}</p>
                        <Button variant="secondary" shadowSize="4" onClick={() => setOpen(false)}>
                            {t('gotIt')}
                        </Button>
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    )
}

/**
 * One or more question steps on one screen. The per-step flow passes one step
 * (its sentences are the heading); add-later passes every open step of a
 * feature under its own title. Continue saves each step in order.
 */
export function QuestionStepScreen({
    steps,
    residence,
    feature,
    progress,
    title,
    description,
    continueLabel,
    onBack,
    onSaved,
    onConflict,
}: {
    steps: VerifyOnceStep[]
    residence: string | null
    feature?: VerifyOnceFeature
    progress?: { current: number; total: number }
    title?: ReactNode
    description?: ReactNode
    continueLabel?: string
    onBack?: () => void
    onSaved: (next: VerifyOnceStepId | null, values: Record<string, string>) => void
    onConflict?: (error: AnswerFormError) => void
}) {
    const t = useTranslations('kyc.verifyOnce')
    const form = useAnswerForm(steps, feature, residence)
    const fields = steps.flatMap((s) => s.fields)
    const single = steps.length === 1 ? steps[0] : null
    const heading = useStepHeading(single ?? steps[0])
    // A card + bank user answers two job lists on one screen (Rain's and Bridge's differ).
    const twoJobLists = fields.some((f) => f.key === 'occupation') && fields.some((f) => f.key === 'bankOccupation')
    const hintKey = single && !heading ? (twoJobLists ? 'hints.workTwoLists' : `hints.${single.id}`) : null
    const hint = hintKey && t.has(hintKey as never) ? t(hintKey as never) : null
    // Past three sentences the step uses the smaller heading, so its CTA stays on screen.
    const compact = !!title || fields.filter(isSentenceField).length > 3
    const complete = stepComplete(fields, form.values)

    const submit = async () => {
        if (!complete) return
        const outcome = await form.save()
        if (outcome.ok) onSaved(outcome.next, form.values)
        else if (outcome.error && outcome.error !== 'retry') onConflict?.(outcome.error)
    }

    return (
        <VerifyQuestionLayout
            progress={progress}
            onBack={onBack}
            footer={
                <VerifyFooter
                    actions={
                        <Button
                            shadowSize="4"
                            className="w-full"
                            onClick={() => void submit()}
                            disabled={!complete || form.saving}
                            loading={form.saving}
                            data-testid="verify-continue"
                        >
                            {continueLabel ?? t('continue')}
                        </Button>
                    }
                    secondary={<WhyWeAsk steps={steps.map((s) => s.id)} />}
                >
                    {form.formError && (
                        <Callout priority="error" className="w-full text-left" data-testid="verify-form-error">
                            {t(FORM_ERROR_KEYS[form.formError] as never)}
                        </Callout>
                    )}
                </VerifyFooter>
            }
        >
            {title ? (
                <SetupTitleBlock title={title} description={description} size="s" />
            ) : (
                heading && <SetupTitleBlock title={heading.title} description={heading.description} size="s" />
            )}
            <form
                className="contents"
                onSubmit={(e) => {
                    e.preventDefault()
                    void submit()
                }}
            >
                <QuestionFields
                    fields={fields}
                    values={form.values}
                    errors={form.errors}
                    residence={residence}
                    onChange={form.change}
                    sentenceSize={compact ? 's' : 'm'}
                    sentencesAsHeading={!title}
                />
                {/* Return on the last typed field submits, as the CTA does. */}
                <button type="submit" className="sr-only" aria-hidden tabIndex={-1} />
            </form>
            {hint && (
                <p className="flex items-start gap-2 text-body-s leading-5 text-foreground-secondary">
                    <Icon name="info" size={16} className="mt-0.5 shrink-0" />
                    {hint}
                </p>
            )}
        </VerifyQuestionLayout>
    )
}
