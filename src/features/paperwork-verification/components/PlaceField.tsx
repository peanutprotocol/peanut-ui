'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/Global/Drawer'
import { searchKycPlaces } from '@/app/actions/kyc-paperwork-verification'
import type { KycPlace, PaperworkVerificationField } from '@/app/actions/types/kyc-paperwork-verification.types'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { localizedCountryName } from '@/utils/country-name.utils'
import { twMerge } from '@/utils/tw'
import { usePaperworkVerificationTrack } from '../analytics'
import { SentencePill } from './AnswerPicker'

export const PLACE_QUERY_MIN_LENGTH = 3
const SEARCH_DELAY_MS = 250

const searchable = (text: string) =>
    text
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^\p{L}\p{N}]+/gu, '')
        .trim()

/**
 * A typed place with suggestions from the country it belongs to, listed
 * inline under the field once three letters are in. The typed text is the
 * answer, so a village missing from the list is still accepted.
 */
export function PlaceField({
    id,
    field = 'place',
    value,
    country,
    invalid,
    describedBy,
    autoFocus,
    onChange,
    onPick,
}: {
    id: string
    /** the answer's key, for the no-results event */
    field?: string
    value: string
    country: string | null
    invalid?: boolean
    describedBy?: string
    autoFocus?: boolean
    onChange: (value: string) => void
    /** a suggestion was picked (after onChange), as opposed to typed */
    onPick?: (name: string) => void
}) {
    const t = useTranslations('kyc.paperworkVerification.place')
    const listId = `${useId()}-places`
    const [open, setOpen] = useState(false)
    const [places, setPlaces] = useState<KycPlace[] | null>(null)
    const [active, setActive] = useState(-1)
    const latest = useRef(0)
    const track = usePaperworkVerificationTrack()
    const trackRef = useRef(track)
    trackRef.current = track
    const reportedEmpty = useRef(false)
    const ready = !!country && searchable(value).length >= PLACE_QUERY_MIN_LENGTH

    useEffect(() => {
        if (!open || !ready || !country) {
            setPlaces(null)
            return
        }
        const request = ++latest.current
        const timer = setTimeout(async () => {
            const found = await searchKycPlaces(country, value.trim())
            if (request !== latest.current) return
            setPlaces(found)
            setActive(-1)
            // Once per typing session: a village missing from the list is still accepted, but worth knowing.
            if (!found.length && !reportedEmpty.current) {
                reportedEmpty.current = true
                trackRef.current(ANALYTICS_EVENTS.KYC_PV_SEARCH_EMPTY, { field, query_length: value.trim().length })
            }
        }, SEARCH_DELAY_MS)
        return () => clearTimeout(timer)
    }, [open, ready, country, value, field])

    const choose = (place: KycPlace) => {
        onChange(place.name)
        setOpen(false)
        onPick?.(place.name)
    }

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (!open || !places?.length) return
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            const delta = event.key === 'ArrowDown' ? 1 : -1
            setActive((index) => (index + delta + places.length) % places.length)
        } else if (event.key === 'Enter' && active >= 0) {
            event.preventDefault()
            choose(places[active])
        } else if (event.key === 'Escape') {
            event.preventDefault()
            setOpen(false)
        }
    }

    const listed = open && ready && places !== null
    return (
        <div className="w-full">
            <BaseInput
                id={id}
                type="text"
                role="combobox"
                aria-expanded={listed}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={listed && active >= 0 ? `${listId}-${active}` : undefined}
                aria-describedby={describedBy}
                aria-required
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                maxLength={100}
                disabled={!country}
                autoFocus={autoFocus}
                placeholder={country ? t('placeholder') : t('countryFirst')}
                state={invalid ? 'error' : 'default'}
                value={value}
                onChange={(event) => {
                    onChange(event.target.value)
                    setOpen(true)
                }}
                onFocus={() => {
                    reportedEmpty.current = false
                    setOpen(true)
                }}
                onBlur={() => setOpen(false)}
                onKeyDown={onKeyDown}
                className="notranslate"
                data-testid="verify-input-place"
            />
            {listed && (
                <Card className="mt-1 overflow-hidden p-0 shadow-4">
                    <ul
                        id={listId}
                        role="listbox"
                        aria-label={t('suggestions')}
                        className="notranslate max-h-60 w-full overflow-y-auto p-1"
                        // pull-to-refresh listens on `document`; same guard as CountryCombobox
                        onTouchMove={(event) => event.stopPropagation()}
                        // keep the input focused while a row is tapped
                        onMouseDown={(event) => event.preventDefault()}
                        data-testid="verify-place-list"
                    >
                        {places.length === 0 && (
                            <li className="px-3 py-2 text-body-s text-foreground-secondary">{t('noMatch')}</li>
                        )}
                        {places.map((place, index) => (
                            <li
                                key={`${place.name}-${place.region ?? ''}`}
                                id={`${listId}-${index}`}
                                role="option"
                                aria-selected={index === active}
                                onClick={() => choose(place)}
                                onMouseMove={() => setActive(index)}
                                className={twMerge(
                                    'flex w-full cursor-pointer flex-col rounded-sm px-3 py-2 transition-colors select-none',
                                    index === active && 'bg-background-disabled'
                                )}
                            >
                                <span className="text-label-l">{place.name}</span>
                                {place.region && (
                                    <span className="text-body-xs text-foreground-secondary">{place.region}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </div>
    )
}

/**
 * The city of birth as a sentence pill. Its drawer holds the typed field with
 * the country's places as hints: a hint picks and closes in one tap, and Done
 * keeps what was typed, so a village missing from the list still works.
 */
export function PlacePicker({
    field,
    value,
    country,
    invalid,
    onChange,
}: {
    field: PaperworkVerificationField
    value: string
    country: string | null
    invalid?: boolean
    onChange: (value: string) => void
}) {
    const t = useTranslations('kyc.paperworkVerification')
    const locale = useLocale()
    const track = usePaperworkVerificationTrack()
    const id = useId()
    const [open, setOpen] = useState(false)
    const [draft, setDraft] = useState(value)
    const kept = useRef(false)
    const title = t(`pickerTitle.${field.key}` as never)
    const countryName = country ? localizedCountryName(locale, country, country) : null

    const openChange = (next: boolean) => {
        if (next === open) return
        if (next) {
            kept.current = false
            setDraft(value)
            track(ANALYTICS_EVENTS.KYC_PV_PICKER_OPENED, { field: field.key, had_answer: !!value })
        } else track(ANALYTICS_EVENTS.KYC_PV_PICKER_CLOSED, { field: field.key, chose: kept.current })
        setOpen(next)
    }
    const keep = (name: string) => {
        if (!name.trim()) return
        kept.current = true
        onChange(name.trim())
        openChange(false)
    }

    return (
        <Drawer open={open} onOpenChange={openChange} shouldScaleBackground={false}>
            <DrawerTrigger asChild>
                <SentencePill
                    field={field}
                    value={value}
                    shown={value || t('choose')}
                    title={title}
                    invalid={invalid}
                />
            </DrawerTrigger>
            <DrawerContent>
                <div className="flex flex-col gap-4 pb-4">
                    <DrawerTitle>{title}</DrawerTitle>
                    <div className="flex flex-col gap-1">
                        <PlaceField
                            id={`${id}-place`}
                            field={field.key}
                            value={draft}
                            country={country}
                            describedBy={countryName ? `${id}-help` : undefined}
                            autoFocus
                            onChange={setDraft}
                            onPick={keep}
                        />
                        {countryName && (
                            <p id={`${id}-help`} className="text-body-xs text-foreground-secondary">
                                {t('place.inCountry', { country: countryName })}
                            </p>
                        )}
                    </div>
                    <Button
                        shadowSize="4"
                        className="w-full"
                        disabled={!draft.trim()}
                        onClick={() => keep(draft)}
                        data-testid="verify-place-done"
                    >
                        {t('place.done')}
                    </Button>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
