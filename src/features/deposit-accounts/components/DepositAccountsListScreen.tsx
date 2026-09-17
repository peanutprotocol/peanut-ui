'use client'

import { Accordion } from '@/components/0_Bruddle/Accordion'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Notification } from '@/components/0_Bruddle/Notification'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { countryData } from '@/components/AddMoney/consts'
import { CountryList } from '@/components/Common/CountryList'
import { matchesCountryQuery } from '@/components/Common/country-search'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { SearchInput } from '@/components/SearchInput'
import { localizedCountryTitle } from '@/utils/country-name.utils'
import type { GateState } from '@/utils/capability-gate'
import { rewriteMethodPath } from '@/utils/native-routes'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { parseAsStringEnum, useQueryStates } from 'nuqs'
import { useMemo, useState } from 'react'
import { corridorsForCountry } from '../countryCorridor'
import { depositGateView } from '../depositGate'
import { DEPOSIT_RAILS, DEPOSIT_RAIL_ORDER, isClaimable } from '../rails'
import { isResidenceGated, residenceAllows, RESIDENCE_GATED_CORRIDORS } from '../residenceGate'
import { canShare, isHeld } from '../resolveScreen'
import type { DepositAccountView, DepositCorridor, DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { useDepositAccountsEnabled } from '../useDepositAccountsEnabled'
import { useDepositCountryRouting } from '../useDepositCountryRouting'
import { useResidenceIso2s } from '../useResidenceIso2s'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import Image from 'next/image'

/** the crypto entry point, reached from this screen and from the home Add drawer */
const CRYPTO_HREF = '/add-money/crypto'

/**
 * The hub: the accounts this user holds or can claim, and every country they
 * can send money in from.
 *
 * Both jobs are one screen because they were one question: "how does money get
 * into my balance by bank". Add money entered by country and get-paid entered
 * by account, and the two lists disagreed about what a country offered. The
 * accounts come first — they are the reusable answer — and the country list
 * below sends every other country to the route its rail catalogue names.
 *
 * The rows come from the user's own rails, so a corridor they have no rail for
 * is absent rather than present and unavailable — a German user reading an
 * "Unavailable" ARS row learns nothing and doubts the four rows above it.
 *
 * Eligibility is settled here, before any details exist, and per corridor. The
 * failure worth designing against is a user who deposits first and learns
 * their region is unsupported afterwards, when the money has already left —
 * and its near twin, a user whose working US rail made a blocked EUR row look
 * tappable.
 */
// Follow-up: evaluate 1–2 included accounts and a Peanut Tier 2 unlock for more.
// Billing and backend enforcement decisions: mono/projects/virtual-accounts/README.md, Next steps.
export function DepositAccountsListScreen({
    corridors,
    accounts,
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
    const { t, arrival, railName, residenceLine } = useDepositAccountCopy()
    const tMethods = useTranslations('addMoney.methods')
    const locale = useLocale()
    const router = useRouter()
    // A search term is a way of reading this screen, not a place in the app:
    // it survives no refresh and belongs in no shared link, so it stays out of
    // the URL.
    const [query, setQuery] = useState('')
    const term = query.trim().toLowerCase()
    const { openCountry, isCountrySupported } = useDepositCountryRouting()
    // While standing accounts are dark, this screen is the bank country list
    // and nothing else — an empty "Your accounts" section under a feature
    // nobody can use yet would only ask a question it cannot answer.
    const accountsEnabled = useDepositAccountsEnabled()
    const residenceIso2s = useResidenceIso2s()
    // The home drawer already asked bank or crypto, and `?method=bank` is that
    // answer. Offering crypto again here is the question the user just settled.
    const [{ method }] = useQueryStates({ method: parseAsStringEnum(['bank']) })

    // The country list opens on a tap, or on a search that has found one.
    // `null` means nobody has decided yet, so the search still can.
    const [countriesOpen, setCountriesOpen] = useState<boolean | null>(null)

    /**
     * One field filters the whole screen, so every section answers the same
     * question. The countries answer it first, and their corridors carry the
     * answer up to the account rows: "portugal" has to find the euro account,
     * and only the country table knows that Portugal pays in euro.
     */
    const matchingCountries = useMemo(
        () =>
            term
                ? countryData.filter(
                      (country) =>
                          country.type === 'country' &&
                          matchesCountryQuery(country, term, localizedCountryTitle(locale, country))
                  )
                : [],
        [term, locale]
    )
    const corridorsFromCountries = useMemo(
        () => new Set(matchingCountries.flatMap((country) => corridorsForCountry(country))),
        [matchingCountries]
    )
    const matchesCorridor = (corridor: DepositCorridor) =>
        !term ||
        DEPOSIT_RAILS[corridor].currency.toLowerCase().includes(term) ||
        railName(corridor).toLowerCase().includes(term) ||
        corridorsFromCountries.has(corridor)

    // The crypto row answers to its own words — "crypto", and whatever its
    // description says in this language about wallets and exchanges.
    const matchesCrypto =
        !method && (!term || `${tMethods('crypto')} ${tMethods('cryptoDescription')} usdc`.toLowerCase().includes(term))

    /**
     * The rows: this user's own corridors, plus the residence-gated ones, which
     * everybody sees. A Brazilian account is worth knowing about before you
     * live in Brazil, and the screen behind the row is what states the rule.
     */
    const hubCorridors = useMemo(() => {
        const shown = new Set([...corridors, ...RESIDENCE_GATED_CORRIDORS])
        return DEPOSIT_RAIL_ORDER.filter((corridor) => shown.has(corridor))
    }, [corridors])

    const views = hubCorridors
        .filter((corridor) => matchesCorridor(corridor))
        .map((corridor) => ({ corridor, view: depositGateView(gates[corridor]) }))
    // Status lives in the badge on every row, so the body only ever answers
    // "when does the money land". Saying it in both places is how a row ended
    // up reading "Not set up yet" under a "Ready" pill.
    const rowBody = (corridor: DepositCorridor, openable: boolean): string => {
        // The residence rule outranks every other line: it is why the tap will
        // not open an account, and it is true before the accounts arrive.
        const residence = isResidenceGated(corridor) ? residenceLine(corridor) : undefined
        if (residence) return residence.caveat
        // The rows can paint before the accounts arrive. The arrival time is
        // true in that gap too; the status is not, so the badge carries it.
        if (isLoading) return arrival(corridor)
        // A revoked row is closed, not blocked: "verify your identity" would be
        // an instruction that changes nothing. The badge says revoked and the
        // body says what a payer sending money there gets.
        if (accounts[corridor]?.status === 'revoked') return t('list.rowRevoked')
        if (!openable) return t('list.rowBlocked')
        return arrival(corridor)
    }

    /**
     * Where the corridor stands, in the one slot that carries status.
     *
     * A corridor nobody can hold as a standing account is unavailable whatever
     * the accounts call returned, so the rail decides that case rather than the
     * payload — a failed read must not invite a claim on AR or BR.
     *
     * "Unavailable" is reserved for a corridor that is truly closed. A
     * residence-gated row is not closed — it is one residence away — so all
     * three read "Not set up" and the screen behind them carries the reason.
     */
    const rowBadge = (rail: DepositRail, account: DepositAccountView | undefined, gate: GateState) => {
        if (isLoading) return <div className="h-5 w-16 animate-pulse rounded bg-foreground-primary/10" />
        if (isResidenceGated(rail.corridor) && !account)
            return <StatusBadge status="custom" customText={t('list.badgeNotSetUp')} />
        if (!isClaimable(rail) || account?.status === 'unavailable')
            return <StatusBadge status="custom" customText={t('list.badgeUnavailable')} />
        // A read that failed says nothing about what the user holds. "Not set
        // up" is a claim about their account, and the fallback map cannot make
        // it — the notice above owns this state.
        if (isError) return null
        if (account?.timedOut) return <StatusBadge status="failed" />
        switch (account?.status) {
            case 'active':
            case 'retiring':
                return (
                    <StatusBadge
                        status="completed"
                        // "Ready" means a payer can be handed these details
                        // today — the same answer the details footer gives
                        customText={canShare(account, gate) ? t('list.badgeReady') : t('list.badgeActive')}
                    />
                )
            case 'provisioning':
                return <StatusBadge status="pending" />
            case 'revoked':
                return <StatusBadge status="closed" customText={t('list.badgeRevoked')} />
            default:
                return <StatusBadge status="custom" customText={t('list.badgeNotSetUp')} />
        }
    }

    /**
     * Where a row leads.
     *
     * A corridor with no standing account for this user — Argentina, which
     * never has one, or a Brazilian resident who holds none and is not
     * endorsed yet — follows the top-up its own rail names, rather than a claim
     * that cannot happen. Everything else opens the corridor screens, which is
     * also where a non-resident reads the residence rule.
     */
    const openRow = (corridor: DepositCorridor, claimableHere: boolean) => {
        const rail = DEPOSIT_RAILS[corridor]
        const noStandingAccount = !isHeld(accounts[corridor]) && (!isClaimable(rail) || !claimableHere)
        if (rail.topUpHref && noStandingAccount && residenceAllows(corridor, residenceIso2s)) {
            router.push(rewriteMethodPath(rail.topUpHref))
            return
        }
        onOpen(corridor)
    }

    /**
     * The KYC-free way in, and the only one that is not a country. It is a row
     * of the accounts card rather than a box of its own: three stacked cards
     * read as three unrelated screens.
     */
    const cryptoRow = matchesCrypto ? (
        <ListItem
            key="crypto"
            title={tMethods('crypto')}
            body={tMethods('cryptoDescription')}
            bodyWrap
            chevron
            leading={<AvatarWithBadge icon="wallet-outline" size="extra-small" className="bg-action-secondary" />}
            onClick={() => router.push(CRYPTO_HREF)}
            data-testid="add-money-crypto"
        />
    ) : null
    // A corridor with no row left after the search has nothing to label.
    const showAccounts = accountsEnabled && views.length > 0
    const showCountries = !term || matchingCountries.length > 0
    const nothingMatches = !!term && views.length === 0 && !matchesCrypto && !showCountries
    // Two characters is where a search stops matching half the world, so it is
    // where opening the list for the user helps rather than startles.
    const countriesExpanded = countriesOpen ?? (term.length >= 2 && matchingCountries.length > 0)

    return (
        <PageStack>
            <NavHeader title={t('list.addTitle')} onPrev={onBack} />
            <div className="flex flex-col gap-4">
                <TitleBlock title={t('list.addHeading')} />

                {/* one field for the whole screen: accounts, crypto and countries */}
                <SearchInput
                    value={query}
                    onChange={setQuery}
                    onClear={() => setQuery('')}
                    placeholder={t('list.searchPlaceholder')}
                    aria-label={t('list.searchPlaceholder')}
                />

                {/*
                 * A read that failed is not "you hold nothing". Without this the
                 * empty fallback map renders as six unclaimed corridors and the
                 * user is invited to open an account they may already have.
                 * A search hides it: filtering is not the moment to explain a
                 * failed read, and the notice returns when the field clears.
                 */}
                {accountsEnabled && !term && isError && (
                    <Notification
                        priority="error"
                        title={t('list.errorTitle')}
                        ctas={[{ label: t('list.errorRetry'), onClick: onRetry }]}
                    >
                        {t('list.errorBody')}
                    </Notification>
                )}

                {nothingMatches && (
                    <EmptyState
                        icon="search"
                        title={t('list.noMatchTitle', { query: query.trim() })}
                        cta={<LinkButton onClick={() => setQuery('')}>{t('list.clearSearch')}</LinkButton>}
                    />
                )}

                {showAccounts && (
                    <Section title={t('list.sectionTitle')} data-testid="your-accounts">
                        <p className="text-body-s text-foreground-secondary">{t('list.accountsPitch')}</p>
                        <ListGroup>
                            {views.map(({ corridor, view }) => {
                                const rail = DEPOSIT_RAILS[corridor]
                                const account = accounts[corridor]
                                // The gate governs opening a NEW account, not
                                // reading one that already exists — resolveScreen
                                // serves those details read-only. A corridor with
                                // nothing to claim is always open: its details are
                                // the user's own top-up route.
                                // Revoked details still explain returned payments and provide support.
                                // A residence-gated row always opens: the screen behind
                                // it states the rule, and a disabled row states nothing.
                                const openable =
                                    isResidenceGated(corridor) ||
                                    !isClaimable(rail) ||
                                    view.claimable ||
                                    isHeld(account)
                                const disabled = isError || isLoading || !openable

                                return (
                                    <ListItem
                                        key={corridor}
                                        leading={<CorridorFlag iso2={rail.flagIso2} />}
                                        /* a ReactNode title wraps; a bare
                                               string is truncated to one line, and
                                               "GBP · Faster Payments" does not fit
                                               at 375 */
                                        title={<span>{`${rail.currency} · ${railName(corridor)}`}</span>}
                                        body={rowBody(corridor, openable)}
                                        bodyWrap
                                        trailing={rowBadge(rail, account, gates[corridor])}
                                        chevron={!disabled}
                                        disabled={disabled}
                                        onClick={() => openRow(corridor, view.claimable)}
                                        data-testid={`deposit-account-${corridor}`}
                                    />
                                )
                            })}
                            {cryptoRow}
                        </ListGroup>
                    </Section>
                )}

                {/* crypto keeps its row where there is no accounts card to carry it */}
                {!showAccounts && cryptoRow && <ListGroup>{cryptoRow}</ListGroup>}

                {/*
                 * Every other way in. A country resolves to the corridor its
                 * rail catalogue names — the standing account opens above, the
                 * rest open their own flow — and a country with no live rail
                 * offers the waitlist rather than a screen that says "soon".
                 */}
                {showCountries && (
                    <Section title={t('list.countriesTitle')}>
                        <Accordion
                            type="single"
                            collapsible
                            value={countriesExpanded ? 'countries' : ''}
                            onValueChange={(value) => setCountriesOpen(value === 'countries')}
                        >
                            <Accordion.Item value="countries">
                                <Accordion.Trigger>{t('list.countriesPitch')}</Accordion.Trigger>
                                <Accordion.Content>
                                    <CountryList
                                        viewMode="add-withdraw"
                                        flow="add"
                                        searchTerm={query}
                                        onCountryClick={openCountry}
                                        isCountrySupported={isCountrySupported}
                                    />
                                </Accordion.Content>
                            </Accordion.Item>
                        </Accordion>
                    </Section>
                )}
            </div>
        </PageStack>
    )
}

/**
 * ListItem leading for a corridor row. The list-item usage board
 * (17312:136171) lists a flag as a valid leading but no flag primitive exists,
 * so this mirrors the shipped `AddWithdrawCountriesList` leading: one 32px
 * round image, no overlay. Flagged in the PR, not invented.
 */
function CorridorFlag({ iso2 }: { iso2: string }) {
    return (
        <Image
            src={getFlagUrl(iso2)}
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-round object-cover"
        />
    )
}
