'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAlpha2Codes } from 'i18n-iso-countries'
import { currentAppLocale } from '@/i18n/app/locale-store'
import { Button } from '@/components/0_Bruddle/Button'
import { BaseInput } from '@/components/0_Bruddle/BaseInput'
import { Card } from '@/components/0_Bruddle/Card'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { useDepositGateRemediation } from '@/features/deposit-accounts/useDepositGateRemediation'
import { useMoneriumSigner } from '@/hooks/wallet/useMoneriumSigner'
import { moneriumApi, type MoneriumOnboarding } from '@/services/monerium'
import { wireErrorCode } from '@/services/api-error'
import { currencyAccountsKey } from '@/utils/currency-account-queries'
import { currencyOperationSession, assertCurrencyOperationSession } from '@/utils/currency-operation-recovery'
import { MONERIUM_FORM_FIELDS, MONERIUM_DECLARATIONS } from '@/constants/monerium.consts'
import { MoneriumActionError } from './MoneriumActionError'
import { MoneriumAccountView } from './MoneriumAccountView'

export function MoneriumOnboardingView({
    userId,
    initial,
    onClose,
    onDone,
}: {
    userId: string
    initial: MoneriumOnboarding
    onClose: () => void
    onDone?: () => void
}) {
    const t = useAppTranslations('currencyAccounts.monerium')
    const shared = useAppTranslations('currencyAccounts')
    const [snapshot, setSnapshot] = useState(initial)
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [error, setError] = useState<unknown>(null)
    const [busy, setBusy] = useState(false)
    const lock = useRef(false)
    const mounted = useRef(true)
    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])
    const client = useQueryClient()
    const { verifyCorridor, modals } = useDepositGateRemediation()
    const { signMoneriumMessage } = useMoneriumSigner()
    const id = useId()
    const invalidForm = wireErrorCode(error) === 'invalid_form'
    useEffect(() => {
        if (snapshot.nextStep === 'done') onDone?.()
    }, [snapshot.nextStep, onDone])
    const poll = useQuery({
        queryKey: ['monerium-onboarding', userId],
        queryFn: ({ signal }) => moneriumApi.onboarding(signal),
        enabled: snapshot.nextStep === 'wait',
        refetchInterval: 10_000,
        retry: 1,
    })
    useEffect(() => {
        if (poll.data) setSnapshot(poll.data)
    }, [poll.data])
    const run = async (work: () => Promise<MoneriumOnboarding>) => {
        if (lock.current) return
        lock.current = true
        setBusy(true)
        setError(null)
        const version = currencyOperationSession(userId)
        try {
            const next = await work()
            assertCurrencyOperationSession(userId, version)
            if (!mounted.current) return
            setSnapshot(next)
            client.setQueryData(['monerium-onboarding', userId], next)
            if (next.nextStep === 'done') void client.invalidateQueries({ queryKey: currencyAccountsKey(userId) })
        } catch (failure) {
            if (!mounted.current || currencyOperationSession(userId) !== version) return
            setError(failure)
            if (wireErrorCode(failure) === 'verification_required') verifyCorridor('SEPA_EU')
        } finally {
            lock.current = false
            if (mounted.current) setBusy(false)
        }
    }
    const link = () =>
        run(async () => {
            const version = currencyOperationSession(userId)
            const { message } = await moneriumApi.linkMessage()
            assertCurrencyOperationSession(userId, version)
            if (!mounted.current) throw new Error('Account view closed')
            const signature = await signMoneriumMessage(message)
            assertCurrencyOperationSession(userId, version)
            if (!mounted.current) throw new Error('Account view closed')
            return moneriumApi.link(signature)
        })
    const names = new Intl.DisplayNames([currentAppLocale() ?? 'en'], { type: 'region' })
    const countries = Object.keys(getAlpha2Codes())
        .map((code) => ({ code, name: names.of(code) ?? code }))
        .sort((a, b) => a.name.localeCompare(b.name))
    const label = (field: string) => t(`form.field.${field}` as Parameters<typeof t>[0])
    const select = (field: string, options: { value: string; text: string }[]) => (
        <label className="flex flex-col gap-2" key={field} htmlFor={`${id}-${field}`}>
            <span className="text-label-m">{label(field)}</span>
            <select
                id={`${id}-${field}`}
                className="input h-12 px-4"
                required
                disabled={busy}
                value={answers[field] ?? ''}
                aria-invalid={invalidForm || undefined}
                aria-describedby={invalidForm ? `${id}-error` : undefined}
                onChange={(event) => setAnswers((previous) => ({ ...previous, [field]: event.target.value }))}
            >
                <option value="">{t('form.choose')}</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.text}
                    </option>
                ))}
            </select>
        </label>
    )
    if (snapshot.nextStep === 'done')
        return (
            <div className="flex flex-col gap-4">
                <MoneriumAccountView userId={userId} initialIban={snapshot.iban} />
                {onDone && (
                    <Button variant="ghost" onClick={onDone}>
                        {shared('retry')}
                    </Button>
                )}
                <LinkButton className="my-3" onClick={onClose}>
                    {shared('back')}
                </LinkButton>
            </div>
        )
    return (
        <>
            <Card className="flex flex-col gap-4 p-4">
                <h2 className="text-heading-card">{t('title')}</h2>
                {snapshot.nextStep === 'share' && (
                    <>
                        <p>{t('share.consent')}</p>
                        <Button
                            loading={busy}
                            disabled={busy || wireErrorCode(error) === 'kyc_sharing_unavailable'}
                            onClick={() => void run(moneriumApi.share)}
                        >
                            {t('share.continue')}
                        </Button>
                    </>
                )}
                {snapshot.nextStep === 'form' && (
                    <form
                        className="flex flex-col gap-4"
                        onSubmit={(event) => {
                            event.preventDefault()
                            const payload: Record<string, unknown> = { ...answers }
                            for (const field of MONERIUM_DECLARATIONS) payload[field] = answers[field] === 'true'
                            void run(() => moneriumApi.submitForm(payload))
                        }}
                    >
                        {Object.entries(MONERIUM_FORM_FIELDS).map(([field, values]) =>
                            select(
                                field,
                                values.map((value) => ({
                                    value,
                                    text: t(`form.option.${value}` as Parameters<typeof t>[0]),
                                }))
                            )
                        )}
                        {answers.activities === 'ACTIVITY_OTHER' && (
                            <label htmlFor={`${id}-activityOther`}>
                                {label('activityOther')}
                                <BaseInput
                                    id={`${id}-activityOther`}
                                    required
                                    maxLength={1000}
                                    disabled={busy}
                                    value={answers.activityOther ?? ''}
                                    onChange={(event) =>
                                        setAnswers((previous) => ({ ...previous, activityOther: event.target.value }))
                                    }
                                />
                            </label>
                        )}
                        {select(
                            'taxResidenceCountry',
                            countries.map(({ code, name }) => ({ value: code, text: name }))
                        )}
                        <label className="flex flex-col gap-2" htmlFor={`${id}-tin`}>
                            {label('tin')}
                            <BaseInput
                                id={`${id}-tin`}
                                required
                                maxLength={255}
                                disabled={busy}
                                state={invalidForm ? 'error' : 'default'}
                                aria-describedby={invalidForm ? `${id}-error` : undefined}
                                value={answers.tin ?? ''}
                                onChange={(event) =>
                                    setAnswers((previous) => ({ ...previous, tin: event.target.value }))
                                }
                            />
                        </label>
                        {MONERIUM_DECLARATIONS.map((field) =>
                            select(field, [
                                { value: 'true', text: t('form.yes') },
                                { value: 'false', text: t('form.no') },
                            ])
                        )}
                        {invalidForm && (
                            <div id={`${id}-error`}>
                                <MoneriumActionError error={error} />
                            </div>
                        )}
                        <Button type="submit" disabled={busy} loading={busy}>
                            {t('form.submit')}
                        </Button>
                    </form>
                )}
                {snapshot.nextStep === 'link' && (
                    <Button disabled={busy} loading={busy} onClick={() => void link()}>
                        {t('link.sign')}
                    </Button>
                )}
                {snapshot.nextStep === 'iban' && (
                    <Button disabled={busy} loading={busy} onClick={() => void run(moneriumApi.requestIban)}>
                        {t('iban.request')}
                    </Button>
                )}
                {snapshot.nextStep === 'wait' && <p>{t('wait.title')}</p>}
                {snapshot.nextStep === 'unavailable' && (
                    <>
                        <p>{t('unavailable.title')}</p>
                        <MoneriumActionError error={{ code: snapshot.reason ?? 'not_available' }} />
                    </>
                )}
                {error && !invalidForm ? <MoneriumActionError error={error} /> : null}
                {poll.isError && <MoneriumActionError error={poll.error} />}
                <LinkButton className="my-3" onClick={onClose}>
                    {shared('back')}
                </LinkButton>
            </Card>
            {modals}
        </>
    )
}
