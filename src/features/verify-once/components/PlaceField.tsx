'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import Card from '@/components/Global/Card'
import { searchKycPlaces } from '@/app/actions/kyc-verify-once'
import type { KycPlace } from '@/app/actions/types/kyc-verify-once.types'
import { twMerge } from '@/utils/tw'

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
    value,
    country,
    invalid,
    describedBy,
    onChange,
}: {
    id: string
    value: string
    country: string | null
    invalid?: boolean
    describedBy?: string
    onChange: (value: string) => void
}) {
    const t = useTranslations('kyc.verifyOnce.place')
    const listId = `${useId()}-places`
    const [open, setOpen] = useState(false)
    const [places, setPlaces] = useState<KycPlace[] | null>(null)
    const [active, setActive] = useState(-1)
    const latest = useRef(0)
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
        }, SEARCH_DELAY_MS)
        return () => clearTimeout(timer)
    }, [open, ready, country, value])

    const choose = (place: KycPlace) => {
        onChange(place.name)
        setOpen(false)
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
                placeholder={country ? t('placeholder') : t('countryFirst')}
                state={invalid ? 'error' : 'default'}
                value={value}
                onChange={(event) => {
                    onChange(event.target.value)
                    setOpen(true)
                }}
                onFocus={() => setOpen(true)}
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
