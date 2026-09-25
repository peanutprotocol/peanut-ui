'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Accordion } from '@/components/0_Bruddle/Accordion'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Section } from '@/components/0_Bruddle/Section'
import { CountryList } from '@/components/Common/CountryList'
import { Icon } from '@/components/Global/Icons/Icon'
import { CorridorFlag } from '@/features/deposit-accounts/components/CorridorFlag'
import { useDepositAccountCopy } from '@/features/deposit-accounts/useDepositAccountCopy'
import { twMerge } from '@/utils/tw'
import { DEMO_COUNTRIES, logTap } from './demoCountries'

const BANK_ROWS = [
    { currency: 'EUR', flag: 'eu' },
    { currency: 'GBP', flag: 'gb' },
    { currency: 'USD', flag: 'us' },
]

/**
 * Add money, "Other ways to move money into Peanut" (AccountsHubList +
 * DepositAccountsListScreen). Before: the last ListItem of the group toggles
 * a CountryList rendered as the section's footer, a separate card below the
 * group. After: that row is an Accordion.Item inside the same ListGroup, and
 * the list opens inside it.
 */
export function AddMoneyCountriesDemo({ mode }: { mode: 'before' | 'after' }) {
    const { t } = useDepositAccountCopy()
    const tMethods = useTranslations('addMoney.methods')
    const [countriesOpen, setCountriesOpen] = useState(false)

    const bankRows = BANK_ROWS.map((row) => (
        <ListItem
            key={row.currency}
            leading={<CorridorFlag iso2={row.flag} />}
            title={row.currency}
            chevron
            onClick={logTap(row.currency)}
        />
    ))
    const cryptoRow = (
        <ListItem
            key="crypto"
            title={tMethods('crypto')}
            body={tMethods('cryptoDescription')}
            bodyWrap
            chevron
            leading={<IconBubble {...CONCEPT_ICONS.crypto} size="s" />}
            onClick={logTap('crypto')}
        />
    )

    if (mode === 'before') {
        return (
            <Section title={t('list.otherWaysTitle')}>
                <p className="text-body-s text-foreground-secondary">{t('list.otherWaysBody')}</p>
                <ListGroup>
                    {bankRows}
                    {cryptoRow}
                    <ListItem
                        key="countries"
                        title={t('list.countriesTitle')}
                        body={t('list.countriesPitch')}
                        bodyWrap
                        leading={<IconBubble {...CONCEPT_ICONS.otherCountries} size="s" />}
                        trailing={
                            <Icon
                                name="chevron-down"
                                size={20}
                                className={twMerge(
                                    'transition-transform duration-moderate',
                                    countriesOpen && 'rotate-180'
                                )}
                            />
                        }
                        aria-expanded={countriesOpen}
                        onClick={() => setCountriesOpen(!countriesOpen)}
                    />
                </ListGroup>
                {countriesOpen && (
                    <CountryList
                        viewMode="add-withdraw"
                        flow="add"
                        searchTerm=""
                        countries={DEMO_COUNTRIES}
                        onCountryClick={(country) => logTap(country.title)()}
                    />
                )}
            </Section>
        )
    }

    return (
        <Section title={t('list.otherWaysTitle')}>
            <p className="text-body-s text-foreground-secondary">{t('list.otherWaysBody')}</p>
            {/* the root wraps the group: radix finds items through context, and
                ListGroup hands the item its bottom position like any row */}
            <Accordion type="single" collapsible>
                <ListGroup>
                    {bankRows}
                    {cryptoRow}
                    <Accordion.Item key="countries" value="countries">
                        <Accordion.Trigger
                            leading={<IconBubble {...CONCEPT_ICONS.otherCountries} size="s" />}
                            title={t('list.countriesTitle')}
                            body={t('list.countriesPitch')}
                        />
                        <Accordion.Content flush forceMount>
                            <CountryList
                                viewMode="add-withdraw"
                                flow="add"
                                searchTerm=""
                                countries={DEMO_COUNTRIES}
                                onCountryClick={(country) => logTap(country.title)()}
                                continuesGroup
                            />
                        </Accordion.Content>
                    </Accordion.Item>
                </ListGroup>
            </Accordion>
        </Section>
    )
}
