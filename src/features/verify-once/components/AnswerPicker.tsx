'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/Global/Drawer'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import type { VerifyOnceField } from '@/app/actions/types/kyc-verify-once.types'
import { buildResidenceCountryOptions } from '@/utils/residence-options'
import { useOptionLabel } from '../useOptionLabel'

const FIELD_ICONS: Record<string, IconName> = {
    cardPurpose: 'credit-card',
    bankPurpose: 'bank',
    occupation: 'user',
    employmentStatus: 'user',
    annualSalary: 'dollar',
    expectedMonthlyVolume: 'arrow-up-right',
    sourceOfFunds: 'wallet',
    bankOccupation: 'user',
    bankMonthlyPayments: 'arrow-up-right',
    actingAsIntermediary: 'users',
}

// Most picked first, per job list (Rain's for the card, Bridge's for a bank account); a title the list lacks is left out.
const POPULAR_JOBS: Record<string, string[]> = {
    occupation: [
        'Software Developers, Applications',
        'Self-Employee',
        'Accountants and Auditors',
        'Registered Nurses',
        'Retail Salespersons',
        'Customer Service Representatives',
        'Graphic Designers',
        'Lawyers',
        'Taxi Drivers and Chauffeurs',
        'Waiters and Waitresses',
        'Student',
        'Other',
    ],
    bankOccupation: [
        'Software developer',
        'Accountant and auditor',
        'Registered nurse',
        'Retail salesperson',
        'Customer service representative',
        'Graphic designer',
        'Lawyer',
        'Taxi driver',
        'Waiter or waitress',
        'Web developer',
        'Chief executive',
        'Cashier',
    ],
}
const MAX_RESULTS = 40

const normalize = (text: string) =>
    text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
const matchesQuery = (text: string, words: string[]) => words.every((word) => normalize(text).includes(word))

function Flag({ country, size }: { country: string; size: 'xs' | 's' }) {
    return (
        <Image
            src={getFlagUrl(country.toLowerCase())}
            alt=""
            width={64}
            height={64}
            className={size === 'xs' ? 'size-6 rounded-full object-cover' : 'size-8 rounded-full object-cover'}
        />
    )
}

function Leading({ field, value, size }: { field: VerifyOnceField; value: string; size: 'xs' | 's' }) {
    if (field.kind === 'country' && value) return <Flag country={value} size={size} />
    // gray = nothing chosen yet (design.md)
    if (!value) return <IconBubble icon={<span />} size={size} color="gray" />
    return <IconBubble icon={FIELD_ICONS[field.key] ?? 'check'} size={size} color="blue" />
}

/**
 * The inline answer pill of a sentence question ("I earn [pill] a year"): the
 * signup pair screen's picker, opening a drawer of the field's options, or a
 * searchable list for jobs and countries.
 */
export function AnswerPicker({
    field,
    value,
    onChange,
    invalid,
    variant = 'pill',
    id,
}: {
    field: VerifyOnceField
    value: string
    onChange: (value: string) => void
    invalid?: boolean
    /** 'pill' sits inside a sentence; 'field' is a full-width labelled control in a form. */
    variant?: 'pill' | 'field'
    id?: string
}) {
    const t = useTranslations('kyc.verifyOnce')
    const locale = useLocale()
    const label = useOptionLabel()
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const searchable = field.kind === 'occupation' || field.kind === 'country'
    const countries = useMemo(
        () => (field.kind === 'country' ? buildResidenceCountryOptions(locale) : []),
        [field.kind, locale]
    )
    const optionLabel = (option: string) =>
        field.kind === 'country'
            ? (countries.find((c) => c.value === option)?.label ?? option)
            : label(field.key, option)
    const options = field.kind === 'country' ? countries.map((c) => c.value) : (field.options ?? [])
    const shown = value ? optionLabel(value) : t('choose')
    const title = t(`pickerTitle.${field.key}` as never)

    const words = normalize(query).split(/\s+/).filter(Boolean)
    const matches = words.length ? options.filter((o) => matchesQuery(optionLabel(o), words) || o === query) : options
    const popularJobs =
        field.kind === 'occupation' && !words.length
            ? [...new Set([value, ...(POPULAR_JOBS[field.key] ?? [])])].filter((job) => job && options.includes(job))
            : []
    const popular = popularJobs.length ? popularJobs : null
    const listed = popular ?? (searchable ? matches.slice(0, MAX_RESULTS) : options)

    const choose = (option: string) => {
        onChange(option)
        setOpen(false)
        setQuery('')
    }

    return (
        <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
            <DrawerTrigger asChild>
                {variant === 'field' ? (
                    <button
                        type="button"
                        id={id}
                        aria-haspopup="dialog"
                        aria-invalid={invalid || undefined}
                        data-testid={`verify-pick-${field.key}`}
                        className="input flex h-12 w-full items-center gap-2 px-4 text-left"
                    >
                        {value && <Leading field={field} value={value} size="xs" />}
                        <span
                            className={
                                value ? 'min-w-0 flex-1 truncate' : 'min-w-0 flex-1 truncate text-foreground-secondary'
                            }
                        >
                            {shown}
                        </span>
                        <Icon name="chevron-down" size={20} className="shrink-0" />
                    </button>
                ) : (
                    <Button
                        variant="secondary"
                        size="compact"
                        shadowSize="2"
                        aria-label={`${title}: ${shown}`}
                        aria-haspopup="dialog"
                        aria-invalid={invalid || undefined}
                        data-testid={`verify-pick-${field.key}`}
                        className="inline-flex w-fit max-w-[calc(100vw_-_8.5rem)] min-w-0 align-middle"
                        icon={<Leading field={field} value={value} size="xs" />}
                        iconContainerClassName="size-6"
                    >
                        <span className="block min-w-0 truncate" title={shown}>
                            {shown}
                        </span>
                        <Icon name="chevron-down" size={20} className="shrink-0" />
                    </Button>
                )}
            </DrawerTrigger>
            <DrawerContent>
                {/* A search keeps one height while results filter, so the sheet does not jump. */}
                <div className={searchable ? 'flex min-h-[75vh] flex-col gap-4 pb-4' : 'flex flex-col gap-4 pb-4'}>
                    <DrawerTitle>{title}</DrawerTitle>
                    {searchable && (
                        <div className="sticky top-0 z-10 bg-white">
                            <BaseInput
                                type="search"
                                autoComplete="off"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={t(field.kind === 'country' ? 'search.country' : 'search.occupation')}
                                aria-label={t(field.kind === 'country' ? 'search.country' : 'search.occupation')}
                                leftContent={<Icon name="search" size={20} className="text-foreground-secondary" />}
                            />
                        </div>
                    )}
                    <div className="flex flex-col gap-2">
                        {popular && (
                            <p className="text-body-xs font-bold text-foreground-secondary">{t('search.popular')}</p>
                        )}
                        {searchable && !popular && words.length > 0 && matches.length > 0 && (
                            <p className="text-body-xs font-bold text-foreground-secondary">
                                {t('search.matches', { count: matches.length })}
                            </p>
                        )}
                        {listed.length > 0 ? (
                            <ListGroup>
                                {listed.map((option) => (
                                    <ListItem
                                        key={option}
                                        title={optionLabel(option)}
                                        leading={
                                            field.kind === 'country' ? <Flag country={option} size="s" /> : undefined
                                        }
                                        trailing={option === value ? <Icon name="check" size={20} /> : undefined}
                                        aria-label={optionLabel(option)}
                                        className={option === value ? 'bg-background-selection' : undefined}
                                        onClick={() => choose(option)}
                                    />
                                ))}
                            </ListGroup>
                        ) : (
                            <p className="text-body-s text-foreground-secondary">
                                {t(field.kind === 'country' ? 'search.noCountry' : 'search.noJob', { query })}
                            </p>
                        )}
                        {popular && (
                            <p className="text-body-s text-foreground-secondary">
                                {t('search.typeToSearch', { count: options.length })}
                            </p>
                        )}
                        {searchable && !popular && matches.length > MAX_RESULTS && (
                            <p className="text-body-s text-foreground-secondary">{t('search.keepTyping')}</p>
                        )}
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
