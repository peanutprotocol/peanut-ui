'use client'

import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { CountryList } from '@/components/Common/CountryList'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import { SearchInput } from '@/components/SearchInput'
import { corridorTopUpHref } from '@/features/add-money/countryRoutes'
import { useBankRows } from '@/hooks/useBankRows'
import type { GateState } from '@/utils/capability-gate'
import { rewriteMethodPath } from '@/utils/native-routes'
import { withReturnTo } from '@/utils/return-to.utils'
import { twMerge } from '@/utils/tw'
import type { UnlockRow } from '@/utils/unlock-payments.utils'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { parseAsStringEnum, useQueryStates } from 'nuqs'
import { useState } from 'react'
import type { ClaimableCorridor, DepositAccountView, DepositCorridor, UnavailableCorridor } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { useDepositAccountsEnabled } from '../useDepositAccountsEnabled'
import { useDepositCountryRouting } from '../useDepositCountryRouting'
import { useResidenceIso2s } from '../useResidenceIso2s'
import { AccountsHubList } from './AccountsHubList'

/** the crypto entry point, reached from this screen and from the home Add drawer */
const CRYPTO_HREF = '/add-money/crypto'

/** where a flow opened from this screen returns to */
const HUB_HREF = '/add-money?method=bank'

/**
 * Add money: the list Accounts and payments shows, plus crypto and every
 * country the user can send money in from, under one search.
 *
 * The rows are `AccountsHubList`, so the two screens cannot drift apart. What
 * is Add money's own is the tap: a virtual account opens in place, and a bank
 * row opens the transfer the user sends themselves.
 *
 * Eligibility is settled here, before any details exist, and per corridor. The
 * failure worth designing against is a user who deposits first and learns
 * their region is unsupported afterwards, when the money has already left.
 */
// Follow-up: evaluate 1–2 included accounts and a Peanut Tier 2 unlock for more.
// Billing and backend enforcement decisions: mono/projects/virtual-accounts/README.md, Next steps.
export function DepositAccountsListScreen({
    corridors,
    accounts,
    claimable,
    unavailable,
    slotsHeld,
    accountLimit,
    gates,
    isLoading,
    isError,
    onBack,
    onOpen,
    onRetry,
}: {
    /** the corridors this user has a rail for, in catalogue order */
    corridors: DepositCorridor[]
    accounts: Record<DepositCorridor, DepositAccountView | undefined>
    /** the terms a corridor the user does NOT hold would carry, and why it cannot be opened right now */
    claimable?: Record<DepositCorridor, ClaimableCorridor | undefined>
    /** why a corridor is withheld, where the backend says so */
    unavailable?: Record<DepositCorridor, UnavailableCorridor | undefined>
    /** account slots taken, counted as the backend's cap counts them — see `holdsSlot` */
    slotsHeld: number
    /** this user's account limit, where the backend sends it */
    accountLimit?: number
    /** the app's own answer to "can this user deposit here" — one gate per corridor */
    gates: Record<DepositCorridor, GateState>
    /** the corridors and the accounts are both network answers */
    isLoading: boolean
    /** the accounts could not be read at all */
    isError: boolean
    onBack: () => void
    onOpen: (corridor: DepositCorridor) => void
    onRetry: () => void
}) {
    const { t } = useDepositAccountCopy()
    const tMethods = useTranslations('addMoney.methods')
    const tSearch = useTranslations('withdraw.currencyList')
    const router = useRouter()
    const { rows: bankRows } = useBankRows()
    const residenceIso2s = useResidenceIso2s()
    const { openCountry, isCountrySupported } = useDepositCountryRouting({
        accounts,
        claimable,
        unavailable,
        isLoading,
    })
    // The flag gates opening an account, not reading one: money keeps landing
    // on accounts the user already handed out, so those stay readable.
    const claimsEnabled = useDepositAccountsEnabled()
    // The home drawer already asked bank or crypto, and `?method=bank` is that
    // answer. Offering crypto again here is the question the user just settled.
    const [{ method }] = useQueryStates({ method: parseAsStringEnum(['bank']) })

    // Transient UI: neither survives a refresh nor belongs in a shared link.
    const [countriesOpen, setCountriesOpen] = useState(false)
    const [search, setSearch] = useState('')
    const term = search.trim().toLowerCase()

    // A bank row opens the transfer the user sends themselves. The flow is a
    // page of its own, so it carries where the user came from — leaving
    // verification must not strand them on a bare amount route.
    const openTopUp = (row: UnlockRow) => {
        const href = row.corridor && corridorTopUpHref(row.corridor, residenceIso2s)
        if (href) router.push(withReturnTo(rewriteMethodPath(href), HUB_HREF))
    }

    const cryptoRow =
        !method && (!term || tMethods('crypto').toLowerCase().includes(term)) ? (
            <ListItem
                key="crypto"
                title={tMethods('crypto')}
                body={tMethods('cryptoDescription')}
                bodyWrap
                chevron
                leading={<IconBubble icon="coins" color="blue" size="s" />}
                onClick={() => router.push(CRYPTO_HREF)}
                data-testid="add-money-crypto"
            />
        ) : null

    // A search opens the countries by itself: the field above filters them too.
    const countriesToggle = term ? null : (
        <ListItem
            key="countries"
            title={t('list.countriesTitle')}
            body={t('list.countriesPitch')}
            bodyWrap
            leading={<IconBubble icon="globe" color="blue" size="s" />}
            trailing={
                <Icon
                    name="chevron-down"
                    size={20}
                    className={twMerge('transition-transform duration-moderate', countriesOpen && 'rotate-180')}
                />
            }
            aria-expanded={countriesOpen}
            onClick={() => setCountriesOpen(!countriesOpen)}
            data-testid="other-countries-toggle"
        />
    )

    return (
        <PageStack>
            <NavHeader title={t('list.addTitle')} onPrev={onBack} />
            <div className="flex flex-col gap-4">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    onClear={() => setSearch('')}
                    placeholder={tSearch('searchPlaceholder')}
                    aria-label={tSearch('searchPlaceholder')}
                />
                <AccountsHubList
                    accounts={{
                        corridors,
                        accounts,
                        claimable,
                        unavailable,
                        gates,
                        slotsHeld,
                        accountLimit,
                        isLoading,
                        isError,
                        onRetry,
                        onOpen,
                    }}
                    claimsEnabled={claimsEnabled}
                    bankRows={bankRows}
                    onBankRowClick={openTopUp}
                    onChangeResidence={() =>
                        router.push(withReturnTo('/profile/accounts-and-payments?open=residence', HUB_HREF))
                    }
                    searchTerm={term}
                    extraRows={[cryptoRow, countriesToggle].filter((row) => row !== null)}
                    footer={
                        (countriesOpen || !!term) && (
                            <CountryList
                                viewMode="add-withdraw"
                                flow="add"
                                // the field above owns the search
                                searchTerm={term}
                                onCountryClick={openCountry}
                                isCountrySupported={isCountrySupported}
                            />
                        )
                    }
                />
            </div>
        </PageStack>
    )
}
