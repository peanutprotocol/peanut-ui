'use client'

import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { MiniHeader } from '@/components/0_Bruddle/MiniHeader'
import { Notification } from '@/components/0_Bruddle/Notification'
import { PageStack } from '@/components/0_Bruddle/PageStack'
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
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { corridorsForCountry } from '../countryCorridor'
import { depositGateView } from '../depositGate'
import { DEPOSIT_RAILS, isClaimable } from '../rails'
import { canShare, isHeld } from '../resolveScreen'
import type { DepositAccountView, DepositCorridor, DepositHubVariant, DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { useDepositAccountsEnabled } from '../useDepositAccountsEnabled'
import { useDepositCountryRouting } from '../useDepositCountryRouting'
import { DepositGateNotice } from './DepositGateNotice'
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
    variant = 'get-paid',
    onBack,
    onOpen,
    onResolveGate,
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
    /** which job the user came for — it decides the title and the heading, nothing else */
    variant?: DepositHubVariant
    onBack: () => void
    onOpen: (corridor: DepositCorridor) => void
    onResolveGate: (gate: GateState) => void
    onRetry: () => void
}) {
    const { t, arrival, railName } = useDepositAccountCopy()
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

    // Entering by account means the accounts are what the user came to read,
    // so they are what the screen opens on.
    const accountsRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (variant === 'get-paid') accountsRef.current?.scrollIntoView?.({ block: 'start' })
    }, [variant])

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
        !term || `${tMethods('crypto')} ${tMethods('cryptoDescription')} usdc`.toLowerCase().includes(term)

    const views = corridors
        .filter((corridor) => matchesCorridor(corridor))
        .map((corridor) => ({ corridor, view: depositGateView(gates[corridor]) }))
    // The banner names one corridor the user could hold but cannot. Every
    // corridor normally shares one blocker (identity), so this is one sentence
    // rather than six; where they differ, the row's own body says so.
    //
    // Where they differ, a blocker the user can clear outranks one that only
    // says to wait — otherwise a SEPA queue hides the button that would unlock
    // the other five corridors.
    const blockedViews = views.filter(({ corridor, view }) => isClaimable(DEPOSIT_RAILS[corridor]) && view.notice)
    const blocked = blockedViews.find(({ view }) => view.notice?.action !== 'none') ?? blockedViews[0]

    // Status lives in the badge on every row, so the body only ever answers
    // "when does the money land". Saying it in both places is how a row ended
    // up reading "Not set up yet" under a "Ready" pill.
    const rowBody = (corridor: DepositCorridor, openable: boolean): string => {
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
     */
    const rowBadge = (rail: DepositRail, account: DepositAccountView | undefined, gate: GateState) => {
        if (isLoading) return <div className="h-5 w-16 animate-pulse rounded bg-foreground-primary/10" />
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

    const isGetPaid = variant === 'get-paid'
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
    const showAccounts = accountsEnabled && (views.length > 0 || (isGetPaid && !term && !isLoading))
    const showCountries = !term || matchingCountries.length > 0
    const nothingMatches = !!term && views.length === 0 && !matchesCrypto && !showCountries

    return (
        <PageStack>
            <NavHeader title={isGetPaid ? t('title') : t('list.addTitle')} onPrev={onBack} />
            <div className="flex flex-col gap-4">
                <TitleBlock
                    title={isGetPaid ? t('list.heading') : t('list.addHeading')}
                    description={isGetPaid ? t('list.subheading') : undefined}
                />

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

                {accountsEnabled && !term && !isError && blocked?.view.notice && (
                    <DepositGateNotice
                        notice={blocked.view.notice}
                        onAct={() => onResolveGate(gates[blocked.corridor])}
                    />
                )}

                {nothingMatches && (
                    <EmptyState
                        icon="search"
                        title={t('list.noMatchTitle', { query: query.trim() })}
                        cta={<LinkButton onClick={() => setQuery('')}>{t('list.clearSearch')}</LinkButton>}
                    />
                )}

                {showAccounts && (
                    <div ref={accountsRef} className="flex flex-col gap-2" data-testid="your-accounts">
                        <MiniHeader>{t('list.sectionTitle')}</MiniHeader>
                        {/*
                         * No bank rail at all, so there is no corridor to offer. Saying
                         * so is the honest answer on the screen whose subject IS the
                         * accounts; Add money has the countries below to answer with.
                         */}
                        {views.length === 0 && (
                            <EmptyState
                                icon="globe-lock"
                                title={t('list.emptyTitle')}
                                description={t('list.emptyBody')}
                            />
                        )}
                        {(views.length > 0 || cryptoRow) && (
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
                                    const openable = !isClaimable(rail) || view.claimable || isHeld(account)
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
                                            onClick={() => onOpen(corridor)}
                                            data-testid={`deposit-account-${corridor}`}
                                        />
                                    )
                                })}
                                {cryptoRow}
                            </ListGroup>
                        )}
                    </div>
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
                    <div className="flex flex-col gap-2">
                        <MiniHeader>{t('list.countriesTitle')}</MiniHeader>
                        <CountryList
                            viewMode="add-withdraw"
                            flow="add"
                            searchTerm={query}
                            onCountryClick={openCountry}
                            isCountrySupported={isCountrySupported}
                        />
                    </div>
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
