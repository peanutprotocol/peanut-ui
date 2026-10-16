'use client'

import { Fragment, type ReactNode, useId, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Field } from '@/components/0_Bruddle/Field'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import type { VerifyOnceAnswers, VerifyOnceField } from '@/app/actions/types/kyc-verify-once.types'
import { localizedCountryName } from '@/utils/country-name.utils'
import { countryForPhone } from '../callingCodes'
import { fieldErrorKey, formatTaxId, looksLikeItin } from '../verifyOnce.utils'
import { AnswerPicker } from './AnswerPicker'

const SENTENCE_KINDS = new Set(['choice', 'occupation', 'country'])
export const isSentenceField = (field: VerifyOnceField) => SENTENCE_KINDS.has(field.kind) && !field.locked

const ADDRESS_AUTOCOMPLETE: Record<string, string> = {
    street: 'address-line1',
    buildingNumber: 'address-line2',
    town: 'address-level2',
    state: 'address-level1',
    postCode: 'postal-code',
}

const nowrap = (chunks: ReactNode) => <span className="inline-block max-w-full whitespace-nowrap">{chunks}</span>

function Flag({ country }: { country: string }) {
    return (
        <Image
            src={getFlagUrl(country.toLowerCase())}
            alt=""
            width={40}
            height={40}
            className="size-5 rounded-full object-cover"
        />
    )
}

/**
 * The fields of one or more question steps. Tap questions read as sentences
 * with an answer pill ("I was born in [pill]"); typed ones (address, phone,
 * tax number) are labelled fields. Values live in the caller's memory only.
 */
export function QuestionFields({
    fields,
    values,
    errors,
    residence,
    onChange,
    sentenceSize = 'm',
}: {
    fields: VerifyOnceField[]
    values: VerifyOnceAnswers
    errors: Record<string, string>
    residence: string | null
    onChange: (key: string, value: string) => void
    /** One step leads with its sentences as the heading; a screen of several steps has its own title. */
    sentenceSize?: 'm' | 's'
}) {
    const t = useTranslations('kyc.verifyOnce')
    const locale = useLocale()
    const Sentences = sentenceSize === 'm' ? 'h1' : 'p'
    const id = useId()
    const sentences = fields.filter(isSentenceField)
    const typed = fields.filter((f) => !isSentenceField(f))
    const errorText = (key: string) => (errors[key] ? t(`errors.${fieldErrorKey(errors[key])}` as never) : null)

    return (
        <>
            {sentences.length > 0 && (
                <div className="flex flex-col gap-2">
                    <Sentences
                        className={
                            sentenceSize === 'm'
                                ? 'text-heading-m leading-[2.75rem] compact:text-heading-s compact:leading-[2.5rem] tight:leading-[2.25rem]'
                                : 'text-heading-s leading-[2.5rem] compact:leading-[2.25rem]'
                        }
                    >
                        {sentences.map((field, index) => (
                            <Fragment key={field.key}>
                                {index > 0 && (
                                    <span
                                        aria-hidden="true"
                                        className={sentenceSize === 'm' ? 'block h-4 compact:h-2' : 'block h-2'}
                                    />
                                )}
                                {t.has(`sentence.${field.key}` as never) ? (
                                    t.rich(`sentence.${field.key}` as 'sentence.cardPurpose', {
                                        nw: nowrap,
                                        pill: () => (
                                            <AnswerPicker
                                                field={field}
                                                value={values[field.key] ?? ''}
                                                invalid={!!errors[field.key]}
                                                onChange={(value) => onChange(field.key, value)}
                                            />
                                        ),
                                    })
                                ) : (
                                    <AnswerPicker
                                        field={field}
                                        value={values[field.key] ?? ''}
                                        invalid={!!errors[field.key]}
                                        onChange={(value) => onChange(field.key, value)}
                                    />
                                )}
                            </Fragment>
                        ))}
                    </Sentences>
                    {sentences.map((field) => (
                        <FieldError key={field.key} data-testid={`verify-error-${field.key}`}>
                            {errorText(field.key)}
                        </FieldError>
                    ))}
                </div>
            )}
            {typed.length > 0 && (
                <TypedFields
                    fields={typed}
                    values={values}
                    residence={residence}
                    locale={locale}
                    idPrefix={id}
                    errorText={errorText}
                    onChange={onChange}
                />
            )}
        </>
    )
}

function TypedFields({
    fields,
    values,
    residence,
    locale,
    idPrefix,
    errorText,
    onChange,
}: {
    fields: VerifyOnceField[]
    values: VerifyOnceAnswers
    residence: string | null
    locale: string
    idPrefix: string
    errorText: (key: string) => string | null
    onChange: (key: string, value: string) => void
}) {
    const t = useTranslations('kyc.verifyOnce')
    const byKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields])
    const input = (field: VerifyOnceField, extra?: Partial<React.ComponentProps<typeof BaseInput>>) => {
        const inputId = `${idPrefix}-${field.key}`
        const error = errorText(field.key)
        return (
            <BaseInput
                id={inputId}
                name={field.key}
                value={values[field.key] ?? ''}
                onChange={(e) => onChange(field.key, e.target.value)}
                state={error ? 'error' : 'default'}
                aria-describedby={error ? `${inputId}-error` : undefined}
                aria-required={field.required || undefined}
                enterKeyHint="next"
                maxLength={100}
                placeholder={field.required ? undefined : t('optional')}
                data-testid={`verify-input-${field.key}`}
                {...extra}
            />
        )
    }
    const fieldFor = (
        field: VerifyOnceField | undefined,
        children: (f: VerifyOnceField) => ReactNode,
        helper?: ReactNode
    ) => {
        if (!field) return null
        const inputId = `${idPrefix}-${field.key}`
        const label =
            field.kind === 'taxId'
                ? t(`tax.label.${field.format ?? 'other'}` as never)
                : t.has(`labels.${field.key}` as never)
                  ? t(`labels.${field.key}` as never)
                  : field.key
        return (
            <Field
                key={field.key}
                label={label}
                htmlFor={inputId}
                error={errorText(field.key)}
                errorId={`${inputId}-error`}
                helper={helper}
            >
                {children(field)}
            </Field>
        )
    }

    const address = ['street', 'buildingNumber', 'town', 'state', 'postCode', 'country'].some((k) => byKey.has(k))
    const known = new Set(['street', 'buildingNumber', 'town', 'state', 'postCode', 'country', 'phone', 'taxId'])
    const country = byKey.get('country')
    const phone = byKey.get('phone')
    const tax = byKey.get('taxId')
    const taxFormat = tax?.format ?? null
    const taxValue = tax ? (values[tax.key] ?? '') : ''
    const itin = looksLikeItin(taxFormat, taxValue)

    return (
        <div className="flex flex-col gap-4 compact:gap-3">
            {address && (
                <>
                    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
                        {fieldFor(byKey.get('street'), (f) => input(f, { autoComplete: ADDRESS_AUTOCOMPLETE.street }))}
                        {fieldFor(byKey.get('buildingNumber'), (f) =>
                            input(f, { autoComplete: ADDRESS_AUTOCOMPLETE.buildingNumber })
                        )}
                    </div>
                    {fieldFor(byKey.get('town'), (f) => input(f, { autoComplete: ADDRESS_AUTOCOMPLETE.town }))}
                    <div className="grid grid-cols-2 gap-3">
                        {fieldFor(byKey.get('state'), (f) => input(f, { autoComplete: ADDRESS_AUTOCOMPLETE.state }))}
                        {fieldFor(byKey.get('postCode'), (f) =>
                            input(f, { autoComplete: ADDRESS_AUTOCOMPLETE.postCode, autoCapitalize: 'characters' })
                        )}
                    </div>
                    {country &&
                        fieldFor(
                            country,
                            (f) => {
                                const code = f.value ?? values[f.key] ?? residence ?? ''
                                return (
                                    <BaseInput
                                        id={`${idPrefix}-${f.key}`}
                                        value={code ? localizedCountryName(locale, code, code) : ''}
                                        readOnly
                                        disabled={f.locked}
                                        leftContent={code ? <Flag country={code} /> : undefined}
                                        data-testid="verify-input-country"
                                    />
                                )
                            },
                            country.locked ? t('labels.countryLocked') : undefined
                        )}
                </>
            )}
            {phone &&
                fieldFor(
                    phone,
                    (f) => {
                        const flag = countryForPhone(values[f.key] ?? '', residence)
                        return input(f, {
                            type: 'tel',
                            inputMode: 'tel',
                            autoComplete: 'tel',
                            leftContent: flag ? <Flag country={flag} /> : undefined,
                            enterKeyHint: 'done',
                        })
                    },
                    t('phoneHelp')
                )}
            {tax &&
                fieldFor(
                    tax,
                    (f) =>
                        input(f, {
                            inputMode: taxFormat && ['ssn', 'cuit', 'cpf'].includes(taxFormat) ? 'numeric' : 'text',
                            autoComplete: 'off',
                            autoCorrect: 'off',
                            spellCheck: false,
                            placeholder: t(`tax.placeholder.${taxFormat ?? 'other'}` as never),
                            enterKeyHint: 'done',
                            maxLength: 30,
                            onChange: (e) => onChange(f.key, formatTaxId(taxFormat, e.target.value)),
                            state: itin || errorText(f.key) ? 'error' : 'default',
                        }),
                    itin ? undefined : t(`tax.help.${taxFormat ?? 'other'}` as never)
                )}
            {itin && !errorText('taxId') && <FieldError>{t('errors.itinNotAccepted')}</FieldError>}
            {fields.filter((f) => !known.has(f.key)).map((f) => fieldFor(f, (field) => input(field)))}
        </div>
    )
}
