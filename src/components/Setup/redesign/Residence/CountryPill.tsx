'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Button } from '@/components/0_Bruddle/Button'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/Global/Drawer'
import { Icon } from '@/components/Global/Icons/Icon'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { normalizeSearch } from '@/features/paperwork-verification/occupations/search'
import { useSignupControl } from '@/features/setup/useSignupControl'
import type { ResidenceCountryOption } from '@/utils/residence-options'
import { twMerge } from '@/utils/tw'

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

/** The mock's row heights: 56 px (44 on a small phone), the same-country row 64 (52). The flag stays 32 px. */
const ROW = 'py-3 signup-sm:py-1.5'
const SAME_ROW = 'py-[11px] signup-sm:py-[5px]'

/**
 * Opens the list at the chosen country, centred where the list allows it. Set directly, so the sheet does not
 * visibly scroll while it slides in.
 */
function centreChosenRow(area: HTMLElement | null) {
    const row = area?.querySelector<HTMLElement>('[aria-current]')
    if (!area || !row) return
    const top = row.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop
    area.scrollTop = Math.max(0, top - (area.clientHeight - row.offsetHeight) / 2)
}

/**
 * A country pill inside the 07 sentence, opening a searchable country drawer. Behaviour and analytics as dev's
 * SetupCountryPicker. With `same`, an empty value means "the same country": the pill shows that country's name with
 * no icon, and the drawer leads with a "The same country" row. The pill shrinks to its line and truncates only there.
 */
export function CountryPill({
    title,
    value,
    options,
    onChange,
    same,
    testId,
    control,
    onSheetChange,
}: {
    title: string
    value: string
    options: ResidenceCountryOption[]
    onChange: (country: string) => void
    same?: string
    testId: string
    /** The analytics name of this picker. */
    control: string
    /** The drawer's state for the screen's `data-setup-state`: open, open with no match, or closed (null). */
    onSheetChange?: (sheet: 'open' | 'no-results' | null) => void
}) {
    const t = useTranslations('setupRedesign.residence')
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const scrollArea = useRef<HTMLDivElement>(null)
    const { track, trackOnce, trackError } = useSignupControl()
    const labelOf = (country: string) => options.find((o) => o.value === country)?.label ?? country
    const isSame = !!same && !value
    const shown = isSame ? labelOf(same) : value ? labelOf(value) : t('choose')
    const words = normalizeSearch(query).split(/\s+/).filter(Boolean)
    const listed = words.length
        ? options.filter((o) => words.every((word) => normalizeSearch(o.label).includes(word)))
        : options

    const noResults = words.length > 0 && listed.length === 0
    useEffect(() => {
        trackError(`${control}_search`, noResults ? 'no_results' : null)
    }, [control, noResults, trackError])
    useEffect(() => {
        onSheetChange?.(open ? (noResults ? 'no-results' : 'open') : null)
    }, [open, noResults, onSheetChange])

    const choose = (country: string) => {
        track(control, 'select', country || 'same')
        onChange(country)
        setOpen(false)
        setQuery('')
    }

    return (
        <Drawer
            open={open}
            onOpenChange={(next) => {
                track(control, next ? 'open' : 'dismiss')
                setOpen(next)
            }}
            shouldScaleBackground={false}
        >
            <DrawerTrigger asChild>
                <Button
                    variant="secondary"
                    size="compact"
                    shadowSize="2"
                    aria-label={`${title}: ${isSame ? `${t('sameRow')}, ${shown}` : shown}`}
                    aria-haspopup="dialog"
                    data-testid={testId}
                    data-pill-state={isSame ? 'same' : value ? 'chosen' : 'empty'}
                    className="mx-1.5 inline-flex w-fit min-w-0 shrink signup-sm:mx-1"
                    icon={
                        isSame ? undefined : value ? (
                            <Flag country={value} size="xs" />
                        ) : (
                            <Icon name="question-mark" size={20} className="text-foreground-secondary" />
                        )
                    }
                    iconContainerClassName="size-6"
                >
                    <span className="block min-w-0 truncate" title={shown} data-fit-label={control}>
                        {shown}
                    </span>
                    <Icon name="chevron-down" size={20} className="shrink-0" />
                </Button>
            </DrawerTrigger>
            <DrawerContent
                scrollAreaRef={scrollArea}
                // vaul leaves focus on the pill behind the modal sheet (its `autoFocus` is off), so Tab first walked
                // the hidden page (review R2-06). Focus the sheet itself, not its search field, so a phone does not
                // raise the keyboard on open; Radix then traps Tab inside and returns focus to the pill on close.
                onOpenAutoFocus={(event) => {
                    event.preventDefault()
                    ;(event.currentTarget as HTMLElement).focus()
                    centreChosenRow(scrollArea.current)
                }}
            >
                {/* One height while results filter, so the sheet does not jump. */}
                <div className="flex min-h-[75vh] flex-col gap-4 pb-4 signup-sm:gap-2">
                    <DrawerTitle>{title}</DrawerTitle>
                    {same && (
                        <ListGroup>
                            <ListItem
                                title={t('sameRow')}
                                body={labelOf(same)}
                                leading={<Flag country={same} size="s" />}
                                trailing={isSame ? <Icon name="check" size={20} /> : undefined}
                                className={twMerge(SAME_ROW, isSame && 'bg-background-selection')}
                                aria-label={`${t('sameRow')}, ${labelOf(same)}`}
                                aria-current={isSame || undefined}
                                onClick={() => choose('')}
                            />
                        </ListGroup>
                    )}
                    <div className="sticky top-0 z-10 bg-background-default">
                        <BaseInput
                            type="search"
                            autoComplete="off"
                            value={query}
                            onChange={(e) => {
                                trackOnce(`${control}_search`, 'change')
                                setQuery(e.target.value)
                            }}
                            placeholder={t('search')}
                            aria-label={t('search')}
                            leftContent={<Icon name="search" size={20} className="text-foreground-secondary" />}
                        />
                    </div>
                    {listed.length > 0 ? (
                        <ListGroup>
                            {listed.map((option) => (
                                <ListItem
                                    key={option.value}
                                    title={option.label}
                                    leading={<Flag country={option.value} size="s" />}
                                    trailing={option.value === value ? <Icon name="check" size={20} /> : undefined}
                                    className={twMerge(ROW, option.value === value && 'bg-background-selection')}
                                    aria-label={option.label}
                                    aria-current={option.value === value || undefined}
                                    onClick={() => choose(option.value)}
                                />
                            ))}
                        </ListGroup>
                    ) : (
                        <p className="text-body-s text-foreground-secondary">{t('noCountry', { query })}</p>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    )
}
