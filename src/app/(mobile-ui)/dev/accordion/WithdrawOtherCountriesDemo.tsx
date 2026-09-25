'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Accordion } from '@/components/0_Bruddle/Accordion'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { CountryList } from '@/components/Common/CountryList'
import { Icon } from '@/components/Global/Icons/Icon'
import { twMerge } from '@/utils/tw'
import { DEMO_COUNTRIES, logTap } from './demoCountries'

/**
 * Withdraw "Other countries" (WithdrawCurrencyList). Before: a solo ListItem
 * that turns into the top of a card when open, the CountryList joined below.
 * After: a solo Accordion.Item with the list in flush content, kept mounted.
 */
export function WithdrawOtherCountriesDemo({ mode }: { mode: 'before' | 'after' }) {
    const t = useTranslations('withdraw')
    const [otherCountriesOpen, setOtherCountriesOpen] = useState(false)
    const countries = (
        <CountryList
            viewMode="add-withdraw"
            flow="withdraw"
            searchTerm=""
            countries={DEMO_COUNTRIES}
            onCountryClick={(country) => logTap(country.title)()}
            continuesGroup
        />
    )

    if (mode === 'before') {
        return (
            <div>
                <ListItem
                    title={t('currencyList.otherCountriesTitle')}
                    body={t('currencyList.otherCountriesPitch')}
                    bodyWrap
                    leading={<IconBubble {...CONCEPT_ICONS.otherCountries} size="s" />}
                    trailing={
                        <Icon
                            name="chevron-down"
                            size={20}
                            className={twMerge(
                                'transition-transform duration-moderate',
                                otherCountriesOpen && 'rotate-180'
                            )}
                        />
                    }
                    position={otherCountriesOpen ? 'top' : 'solo'}
                    aria-expanded={otherCountriesOpen}
                    onClick={() => setOtherCountriesOpen((open) => !open)}
                />
                {otherCountriesOpen && countries}
            </div>
        )
    }

    return (
        <Accordion type="single" collapsible>
            <Accordion.Item value="other-countries">
                <Accordion.Trigger
                    leading={<IconBubble {...CONCEPT_ICONS.otherCountries} size="s" />}
                    title={t('currencyList.otherCountriesTitle')}
                    body={t('currencyList.otherCountriesPitch')}
                />
                <Accordion.Content flush forceMount>
                    {countries}
                </Accordion.Content>
            </Accordion.Item>
        </Accordion>
    )
}
