'use client'

import { Accordion } from '@/components/0_Bruddle/Accordion'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { CountryList } from '@/components/Common/CountryList'
import NavHeader from '@/components/Global/NavHeader'
import { SearchInput } from '@/components/SearchInput'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { trackAddMoney } from '@/features/add-money/analytics'
import { corridorTopUpHref } from '@/features/add-money/countryRoutes'
import { openBrazilPausedDrawer } from '@/features/brazil-pause/brazil-paused-drawer-store'
import { useBrazilServicesPaused } from '@/features/brazil-pause/useBrazilServicesPaused'
import { useBankRows } from '@/hooks/useBankRows'
import type { GateState } from '@/utils/capability-gate'
import { rewriteMethodPath } from '@/utils/native-routes'
import { withReturnTo } from '@/utils/return-to.utils'
import type { UnlockRow } from '@/utils/unlock-payments.utils'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { parseAsStringEnum, useQueryStates } from 'nuqs'
import { useEffect, useRef, useState } from 'react'
import { residenceAllows } from '../residenceGate'
import type { ClaimableCorridor, DepositAccountView, DepositCorridor, UnavailableCorridor } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { useDepositAccountsEnabled } from '../useDepositAccountsEnabled'
import { useDepositCountryRouting } from '../useDepositCountryRouting'
import { useResidenceIso2s } from '../useResidenceIso2s'
import { AccountsHubList } from './AccountsHubList'
import { ClosedRowDrawer } from './ClosedRowDrawer'

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
    presentation = 'add-money',
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
    /** Keep the originating Bank account list behind its corridor drawer. */
    presentation?: 'add-money' | 'bank-account'
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
    const tProfile = useTranslations('profile.unlockPayments')
    const bankAccount = presentation === 'bank-account'
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
    const [showArgentinaRestriction, setShowArgentinaRestriction] = useState(false)
    const argentinaUnavailable = residenceIso2s.length > 0 && !residenceAllows('BANK_TRANSFER_AR', residenceIso2s)
    useEffect(() => {
        if (!argentinaUnavailable) setShowArgentinaRestriction(false)
    }, [argentinaUnavailable])
    const openResidenceSettings = () => router.push(withReturnTo('/settings/details?open=residence', HUB_HREF))
    const [search, setSearch] = useState('')
    const term = bankAccount ? '' : search.trim().toLowerCase()
    const viewed = useRef(false)
    useEffect(() => {
        if (bankAccount || viewed.current) return
        viewed.current = true
        trackAddMoney(ANALYTICS_EVENTS.ADD_MONEY_VIEWED)
    }, [bankAccount])

    // A bank row opens the transfer the user sends themselves. The flow is a
    // page of its own, so it carries where the user came from — leaving
    // verification must not strand them on a bare amount route.
    const brazilPaused = useBrazilServicesPaused()
    const openTopUp = (row: UnlockRow) => {
        if (brazilPaused && row.corridor === 'PIX_BR') return openBrazilPausedDrawer()
        const href = row.corridor && corridorTopUpHref(row.corridor, residenceIso2s)
        if (href) router.push(withReturnTo(rewriteMethodPath(href), HUB_HREF))
    }

    const cryptoRow =
        !bankAccount && !method && (!term || tMethods('crypto').toLowerCase().includes(term)) ? (
            <ListItem
                key="crypto"
                title={tMethods('crypto')}
                body={tMethods('cryptoDescription')}
                bodyWrap
                chevron
                leading={<IconBubble {...CONCEPT_ICONS.crypto} size="s" />}
                onClick={() => router.push(CRYPTO_HREF)}
                data-testid="add-money-crypto"
            />
        ) : null

    const countryList = (
        <CountryList
            viewMode="add-withdraw"
            flow="add"
            // the field above owns the search
            searchTerm={term}
            onCountryClick={openCountry}
            onCountrySelect={(country, outcome) => {
                if (!bankAccount) {
                    trackAddMoney(ANALYTICS_EVENTS.ADD_MONEY_COUNTRY_SELECTED, {
                        country: country.path,
                        source: term ? 'search' : 'all_countries',
                        outcome,
                    })
                }
            }}
            isCountrySupported={isCountrySupported}
            restrictedCountry={
                argentinaUnavailable
                    ? {
                          id: 'AR',
                          label: t('list.badgeNotOffered'),
                          onExplain: () => setShowArgentinaRestriction(true),
                      }
                    : undefined
            }
        />
    )

    // A search opens the countries by itself: the field above filters them
    // too, so the row that opens them steps aside while the user types.
    const countries = term ? (
        countryList
    ) : (
        <Accordion
            type="single"
            collapsible
            variant="detached"
            value={countriesOpen ? 'countries' : ''}
            onValueChange={(value) => {
                const open = !!value
                setCountriesOpen(open)
                if (!bankAccount) {
                    trackAddMoney(
                        open
                            ? ANALYTICS_EVENTS.ADD_MONEY_COUNTRY_LIST_OPENED
                            : ANALYTICS_EVENTS.ADD_MONEY_COUNTRY_LIST_CLOSED
                    )
                }
            }}
        >
            <Accordion.Item value="countries">
                <Accordion.Trigger
                    leading={<IconBubble {...CONCEPT_ICONS.otherCountries} size="s" />}
                    title={t('list.countriesTitle')}
                    data-testid="other-countries-toggle"
                />
                <Accordion.Content flush>{countryList}</Accordion.Content>
            </Accordion.Item>
        </Accordion>
    )

    return (
        <PageStack gap={bankAccount ? '6' : '8'} className={bankAccount ? 'pb-10' : undefined}>
            <NavHeader
                title={bankAccount ? tProfile('titles.bank') : t('list.addTitle')}
                onPrev={() => {
                    if (!bankAccount) {
                        trackAddMoney(ANALYTICS_EVENTS.ADD_MONEY_BACK_TAPPED, {
                            country_list_source: term ? 'search' : countriesOpen ? 'all_countries' : 'none',
                        })
                    }
                    onBack()
                }}
                titleClassName={bankAccount ? 'py-2 text-heading-xs md:py-1 md:text-heading-s' : undefined}
            />
            <div className="flex flex-col gap-4">
                {!bankAccount && (
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        onClear={() => setSearch('')}
                        placeholder={tSearch('searchPlaceholder')}
                        aria-label={tSearch('searchPlaceholder')}
                    />
                )}
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
                    onVerifyPix={
                        bankAccount && gates.PIX_BR?.kind === 'needs-identity' && !brazilPaused
                            ? () => onOpen('PIX_BR')
                            : undefined
                    }
                    onChangeResidence={openResidenceSettings}
                    searchTerm={term}
                    extraRows={cryptoRow ? [cryptoRow] : []}
                    footer={bankAccount ? undefined : countries}
                />
            </div>
            {!bankAccount && showArgentinaRestriction && argentinaUnavailable && (
                <ClosedRowDrawer
                    closed={{ kind: 'residence', corridor: 'BANK_TRANSFER_AR' }}
                    onClose={() => setShowArgentinaRestriction(false)}
                    onChangeResidence={openResidenceSettings}
                    onPayQr={() => router.push('/qr-pay')}
                />
            )}
        </PageStack>
    )
}
