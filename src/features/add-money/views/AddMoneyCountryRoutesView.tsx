'use client'

import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import NavHeader from '@/components/Global/NavHeader'
import type { CountryData } from '@/components/AddMoney/consts'
import { useDepositAccountCopy } from '@/features/deposit-accounts/useDepositAccountCopy'
import { localizedCountryTitle } from '@/utils/country-name.utils'
import { useLocale, useTranslations } from 'next-intl'
import type { AddMoneyRoute } from '../countryRoutes'

interface AddMoneyCountryRoutesViewProps {
    country: CountryData
    routes: AddMoneyRoute[]
    onBack: () => void
    onSelect: (route: AddMoneyRoute) => void
}

/**
 * The one extra step a country needs when it offers more than one bank route.
 *
 * Brazil is the case today: standing Pix details a payer can use again and
 * again, and a one-off Pix code for the user's own top-up. Both are Pix, so
 * the rail name alone cannot tell them apart — the row says which of the two
 * things it is, and the rail name qualifies it.
 */
export function AddMoneyCountryRoutesView({ country, routes, onBack, onSelect }: AddMoneyCountryRoutesViewProps) {
    const locale = useLocale()
    const t = useTranslations('addMoney')
    const { railName, arrival } = useDepositAccountCopy()

    return (
        <PageStack>
            <NavHeader title={localizedCountryTitle(locale, country)} onPrev={onBack} />
            <Section title={t('addMoneyVia')}>
                <div className="flex flex-col">
                    {routes.map((route, index) => (
                        <ListItem
                            key={`${route.kind}-${route.corridor}`}
                            title={t(`routes.${route.kind}.title`, { rail: railName(route.corridor) })}
                            body={
                                <div className="text-body-xs">
                                    {t(`routes.${route.kind}.body`)} · {arrival(route.corridor)}
                                </div>
                            }
                            bodyWrap
                            chevron
                            onClick={() => onSelect(route)}
                            position={getCardPosition(index, routes.length)}
                            data-testid={`add-money-route-${route.kind}`}
                        />
                    ))}
                </div>
            </Section>
        </PageStack>
    )
}
