'use client'

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import { Icon } from '@/components/Global/Icons/Icon'
import SetupTitleBlock from '@/components/Setup/components/SetupTitleBlock'
import type {
    PaperworkVerificationFeature,
    PaperworkVerificationStep,
    PaperworkVerificationStepId,
} from '@/app/actions/types/kyc-paperwork-verification.types'
import { ANALYTICS_EVENTS, type AnalyticsEvent } from '@/constants/analytics.consts'
import {
    secondsSince,
    stepsLabel,
    trackPaperworkVerification,
    usePaperworkVerificationTrack,
    usePaperworkVerificationTrackingContext,
    PaperworkVerificationTrackingProvider,
} from '../analytics'
import { isE164 } from '../callingCodes'
import { useAnswerForm, type AnswerFormError } from '../useAnswerForm'
import { looksLikeItin, stepComplete } from '../paperworkVerification.utils'
import { isSentenceField, QuestionFields } from './QuestionFields'
import { VerifyFooter, VerifyQuestionLayout } from './VerifyLayout'

const FORM_ERROR_KEYS: Record<AnswerFormError, string> = {
    retry: 'errors.retry',
    invalid_body: 'errors.invalidBody',
    unknown_step: 'errors.unknownStep',
    rate_limited: 'errors.rateLimited',
    feature_not_selected: 'errors.featureNotSelected',
    identity_submitted: 'errors.identitySubmitted',
    unavailable: 'errors.unavailable',
    existing_verification: 'errors.unavailable',
    conflict: 'errors.unavailable',
}

/** Who keeps the phone number: the card partner when the card asks for it, else the local bank partner. */
export const phonePartner = (steps: PaperworkVerificationStep[]): 'card' | 'local' =>
    steps.find((s) => s.id === 'phone')?.features.includes('card') ? 'card' : 'local'

function useStepHeading(step: PaperworkVerificationStep) {
    const t = useTranslations('kyc.paperworkVerification')
    if (step.fields.some(isSentenceField)) return null
    if (step.id === 'phone')
        return { title: t('titles.phone'), description: t(`descriptions.phone.${phonePartner([step])}`) }
    if (step.id === 'tax') {
        const ssn = step.fields.find((f) => f.kind === 'taxId')?.format === 'ssn'
        return {
            title: t(ssn ? 'tax.title.ssn' : 'tax.title.other'),
            description: t(ssn ? 'tax.description.ssn' : 'tax.description.other'),
        }
    }
    if (step.id === 'address' || step.id === 'declarations')
        return { title: t(`titles.${step.id}`), description: t(`descriptions.${step.id}`) }
    return null
}

/** "Why do we ask?": what each answer is for, and that it only reaches the partner that needs it. */
export function WhyWeAsk({ steps }: { steps: PaperworkVerificationStepId[] }) {
    const t = useTranslations('kyc.paperworkVerification')
    const track = usePaperworkVerificationTrack()
    const [open, setOpen] = useState(false)
    return (
        <>
            <LinkButton
                onClick={() => {
                    setOpen(true)
                    track(ANALYTICS_EVENTS.KYC_PV_WHY_OPENED, { steps: steps.join('+') })
                }}
                data-testid="verify-why"
            >
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
    onContinueWithoutLocal,
    onChangeResidence,
}: {
    steps: PaperworkVerificationStep[]
    residence: string | null
    feature?: PaperworkVerificationFeature
    progress?: { current: number; total: number }
    title?: ReactNode
    description?: ReactNode
    continueLabel?: string
    onBack?: () => void
    onSaved: (next: PaperworkVerificationStepId | null, values: Record<string, string>) => void
    onConflict?: (error: AnswerFormError) => void
    onContinueWithoutLocal?: () => Promise<void>
    /** The locked country row's "Change your country of residence". */
    onChangeResidence?: () => void
}) {
    const t = useTranslations('kyc.paperworkVerification')
    const form = useAnswerForm(steps, feature, residence)
    const parentTracking = usePaperworkVerificationTrackingContext()
    const leadStep = steps[0]?.id
    const tracking = useMemo(
        () => ({
            ...(parentTracking ?? {
                flow: feature ? ('add_later' as const) : ('paperwork_verification' as const),
                residence,
            }),
            step: leadStep,
        }),
        [parentTracking, feature, residence, leadStep]
    )
    const track = (event: AnalyticsEvent, properties?: Record<string, unknown>) =>
        trackPaperworkVerification(tracking, event, { steps: stepsLabel(steps), ...properties })
    const viewedAt = useRef(Date.now())
    const rejections = useRef(0)
    const flagged = useRef(new Set<string>())
    const submitting = useRef(false)
    const [removingLocal, setRemovingLocal] = useState(false)
    const removingRef = useRef(false)
    const removeLocal = async () => {
        if (removingRef.current || form.saving) return
        removingRef.current = true
        setRemovingLocal(true)
        track(ANALYTICS_EVENTS.KYC_PV_CONTINUE_WITHOUT_LOCAL)
        try {
            await onContinueWithoutLocal?.()
        } catch {
            form.setFormError('retry')
        } finally {
            removingRef.current = false
            setRemovingLocal(false)
        }
    }
    const fields = steps.flatMap((s) => s.fields)
    const single = steps.length === 1 ? steps[0] : null
    const heading = useStepHeading(single ?? steps[0])
    const hintKey = single && !heading ? `hints.${single.id}` : null
    const hint = hintKey && t.has(hintKey as never) ? t(hintKey as never) : null
    // Past three sentences the step uses the smaller heading, so its CTA stays on screen.
    const compact = !!title || fields.filter(isSentenceField).length > 3
    const complete = stepComplete(fields, form.values)

    useEffect(() => {
        trackPaperworkVerification(tracking, ANALYTICS_EVENTS.KYC_PV_STEP_VIEWED, {
            steps: stepsLabel(steps),
            screen_index: progress?.current ?? null,
            screen_total: progress?.total ?? null,
            field_count: fields.length,
            prefilled_count: fields.filter((f) => !!f.value).length,
        })
        // Once per screen: the step's identity, not its values, makes the view.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    /** A field the screen itself flags while typed (an ITIN, a phone the check would refuse), once per field and code. */
    const onFieldBlur = (key: string) => {
        const field = fields.find((f) => f.key === key)
        const value = form.values[key]?.trim() ?? ''
        if (!field || !value) return
        const phone = field.kind === 'phone' ? value.replace(/[\s()-]/g, '') : ''
        const code =
            field.kind === 'phone' && phone.replace(/\D/g, '').length >= 5 && !isE164(phone)
                ? 'invalid_phone'
                : field.kind === 'taxId' && looksLikeItin(field.format, value)
                  ? 'itin_not_accepted'
                  : null
        if (!code || flagged.current.has(`${key}:${code}`)) return
        flagged.current.add(`${key}:${code}`)
        track(ANALYTICS_EVENTS.KYC_PV_FIELD_ERROR, { field: key, code, source: 'typing' })
    }

    const submit = async () => {
        if (!complete || removingRef.current || submitting.current) return
        submitting.current = true
        const seconds = secondsSince(viewedAt.current)
        track(ANALYTICS_EVENTS.KYC_PV_STEP_SUBMITTED, { seconds_on_step: seconds, rejected_before: rejections.current })
        try {
            const outcome = await form.save()
            if (outcome.ok) {
                track(ANALYTICS_EVENTS.KYC_PV_STEP_SAVED, {
                    seconds_on_step: secondsSince(viewedAt.current),
                    rejected_before: rejections.current,
                })
                onSaved(outcome.next, form.values)
                return
            }
            if (outcome.rejected) {
                rejections.current += 1
                const errors = Object.entries(outcome.rejected.errors)
                track(ANALYTICS_EVENTS.KYC_PV_STEP_REJECTED, {
                    failed_step: outcome.rejected.step,
                    fields: errors.map(([key]) => key),
                    codes: errors.map(([, code]) => code),
                    attempt: rejections.current,
                })
                for (const [key, code] of errors)
                    track(ANALYTICS_EVENTS.KYC_PV_FIELD_ERROR, {
                        field: key,
                        code,
                        source: 'server',
                        failed_step: outcome.rejected.step,
                        attempt: rejections.current,
                    })
                if (errors.some(([, code]) => code === 'us_citizen_not_supported'))
                    track(ANALYTICS_EVENTS.KYC_PV_LOCAL_REFUSED, { reason: 'us_person' })
            }
            if (outcome.formError) track(ANALYTICS_EVENTS.KYC_PV_FORM_ERROR, { error: outcome.formError })
            if (outcome.error && outcome.error !== 'retry') onConflict?.(outcome.error)
        } finally {
            submitting.current = false
        }
    }

    const back = onBack
        ? () => {
              track(ANALYTICS_EVENTS.KYC_PV_BACK, { seconds_on_step: secondsSince(viewedAt.current) })
              onBack()
          }
        : undefined
    const changeResidence = onChangeResidence
        ? () => {
              track(ANALYTICS_EVENTS.KYC_PV_RESIDENCE_CHANGE_OPENED)
              onChangeResidence()
          }
        : undefined

    return (
        <PaperworkVerificationTrackingProvider value={tracking}>
            <VerifyQuestionLayout
                progress={progress}
                onBack={back}
                footer={
                    <VerifyFooter
                        actions={
                            <Button
                                shadowSize="4"
                                className="w-full"
                                onClick={() => void submit()}
                                disabled={!complete || form.saving || removingLocal}
                                loading={form.saving}
                                data-testid="verify-continue"
                            >
                                {continueLabel ?? t('continue')}
                            </Button>
                        }
                        secondary={<WhyWeAsk steps={steps.map((s) => s.id)} />}
                    >
                        {onContinueWithoutLocal && Object.values(form.errors).includes('us_citizen_not_supported') && (
                            <Button
                                variant="secondary"
                                className="w-full"
                                onClick={() => void removeLocal()}
                                loading={removingLocal}
                                disabled={removingLocal || form.saving}
                            >
                                {t('continueWithoutLocal')}
                            </Button>
                        )}
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
                        onFieldBlur={onFieldBlur}
                        onChangeResidence={changeResidence}
                        sentenceSize={compact ? 's' : 'm'}
                        sentencesAsHeading={!title}
                        phonePartner={phonePartner(steps)}
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
        </PaperworkVerificationTrackingProvider>
    )
}
