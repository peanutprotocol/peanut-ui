'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/Global/Drawer'
import { Icon } from '@/components/Global/Icons/Icon'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { normalizeSearch } from '@/features/paperwork-verification/occupations/search'
import type { ResidenceCountryOption } from '@/utils/residence-options'

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

/**
 * A country pill inside the residence sentence ("I'm a resident of [pill]"),
 * opening a searchable list. With `same`, an empty value reads as that
 * country and the list leads with "The same country".
 */
export function SetupCountryPicker({
    title,
    value,
    options,
    onChange,
    same,
    testId,
}: {
    title: string
    value: string
    options: ResidenceCountryOption[]
    onChange: (country: string) => void
    same?: string
    testId: string
}) {
    const t = useTranslations('setup.residenceStep')
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const labelOf = (country: string) => options.find((o) => o.value === country)?.label ?? country
    const isSame = !!same && !value
    const shown = isSame ? t('sameCountry') : value ? labelOf(value) : t('choose')
    const words = normalizeSearch(query).split(/\s+/).filter(Boolean)
    const listed = words.length
        ? options.filter((o) => words.every((word) => normalizeSearch(o.label).includes(word)))
        : options

    const choose = (country: string) => {
        onChange(country)
        setOpen(false)
        setQuery('')
    }

    return (
        <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
            <DrawerTrigger asChild>
                <Button
                    variant="secondary"
                    size="compact"
                    shadowSize="2"
                    aria-label={`${title}: ${isSame && same ? `${t('sameCountry')}, ${labelOf(same)}` : shown}`}
                    aria-haspopup="dialog"
                    data-testid={testId}
                    className="inline-flex w-fit max-w-[calc(100vw_-_8.5rem)] min-w-0 align-middle"
                    icon={
                        isSame ? undefined : value ? (
                            <Flag country={value} size="xs" />
                        ) : (
                            <IconBubble icon={<span />} size="xs" color="gray" />
                        )
                    }
                    iconContainerClassName="size-6"
                >
                    <span className="block min-w-0 truncate" title={shown}>
                        {shown}
                    </span>
                    <Icon name="chevron-down" size={20} className="shrink-0" />
                </Button>
            </DrawerTrigger>
            <DrawerContent>
                {/* One height while results filter, so the sheet does not jump. */}
                <div className="flex min-h-[75vh] flex-col gap-4 pb-4">
                    <DrawerTitle>{title}</DrawerTitle>
                    {same && (
                        <ListGroup>
                            <ListItem
                                title={t('sameCountryRow')}
                                body={labelOf(same)}
                                leading={<Flag country={same} size="s" />}
                                trailing={isSame ? <Icon name="check" size={20} /> : undefined}
                                className={isSame ? 'bg-background-selection' : undefined}
                                aria-label={`${t('sameCountryRow')}, ${labelOf(same)}`}
                                aria-current={isSame || undefined}
                                onClick={() => choose('')}
                            />
                        </ListGroup>
                    )}
                    <div className="sticky top-0 z-10 bg-white">
                        <BaseInput
                            type="search"
                            autoComplete="off"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('searchCountry')}
                            aria-label={t('searchCountry')}
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
                                    className={option.value === value ? 'bg-background-selection' : undefined}
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
