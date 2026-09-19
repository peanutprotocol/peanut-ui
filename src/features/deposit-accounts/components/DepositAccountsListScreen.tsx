'use client'

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
import { Icon } from '@/components/Global/Icons/Icon'
import MoreInfo from '@/components/Global/MoreInfo'
import NavHeader from '@/components/Global/NavHeader'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { SearchInput } from '@/components/SearchInput'
import { localizedCountryTitle } from '@/utils/country-name.utils'
import type { GateState } from '@/utils/capability-gate'
import { rewriteMethodPath } from '@/utils/native-routes'
import { withReturnTo } from '@/utils/return-to.utils'
import { twMerge } from '@/utils/tw'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { parseAsStringEnum, useQueryStates } from 'nuqs'
import { useMemo, useState } from 'react'
import { corridorsForCountry } from '../countryCorridor'
import { depositGateView, isDepositBlock, type DepositGateView } from '../depositGate'
import { DEFAULT_ACCOUNT_LIMIT, DEPOSIT_RAILS, DEPOSIT_RAIL_ORDER, isClaimable, topUpOnlyHref } from '../rails'
import { isResidenceGated, RESIDENCE_GATED_CORRIDORS } from '../residenceGate'
import { canShare, isHeld } from '../resolveScreen'
import type { ClaimableCorridor, UnavailableCorridor, DepositAccountView, DepositCorridor, DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { useDepositAccountsEnabled } from '../useDepositAccountsEnabled'
import { useDepositCountryRouting } from '../useDepositCountryRouting'
import { CorridorFlag } from './CorridorFlag'

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
// TODO(va): extract shared currency-first selector shell (with WithdrawCurrencyList)
export function DepositAccountsListScreen({
    corridors,
    accounts,
    claimable,
    unavailable,
    slotsHeld,
    accountLimit: userAccountLimit,
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
    /**
     * The terms a corridor the user does NOT hold would carry, and why it
     * cannot be opened right now. A corridor whose provider review is under way
     * has no account yet and still has a status worth showing.
     */
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
    const { t, railName } = useDepositAccountCopy()
    const tMethods = useTranslations('addMoney.methods')
    const tCommon = useTranslations('common')
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
     *
     * A user who has not verified holds a rail for nothing, so the standing
     * accounts they could open by verifying would be missing from the hub
     * entirely — they never learn the accounts exist or what they need. Show
     * the claimable ones with a "requires verification" badge, but ONLY where
     * the gate is `needs-identity` (identity not cleared yet). A verified user whose
     * region has no such corridor resolves to `needs-enrollment` instead, and
     * showing them a USD or ARS row they can never open is the noise these rows
     * are meant to avoid.
     */
    const hubCorridors = useMemo(() => {
        const shown = new Set([...corridors, ...RESIDENCE_GATED_CORRIDORS])
        for (const corridor of DEPOSIT_RAIL_ORDER) {
            if (isClaimable(DEPOSIT_RAILS[corridor]) && gates[corridor]?.kind === 'needs-identity') shown.add(corridor)
        }
        return DEPOSIT_RAIL_ORDER.filter((corridor) => shown.has(corridor))
    }, [corridors, gates])

    /**
     * Why the backend withholds a corridor, where it said so.
     *
     * The app used to infer this: the capability gate answers `needs-identity`
     * for a corridor whose rail it cannot read as well as for a user who has
     * not verified, and the screen told a verified user with three live
     * accounts to verify, on a row that did not take a tap. The backend now
     * answers the question itself, per corridor.
     *
     * A corridor in none of its three lists is one it would not guess about
     * (the provider read failed), and those rows keep the gate's own answer.
     */
    const reasonFor = (corridor: DepositCorridor) => unavailable?.[corridor]?.reason

    /**
     * Whether the row leads somewhere. No row on this screen may name an action
     * the user cannot take, so the only rows that stay closed are the ones whose
     * own words are the whole answer.
     *
     * The gate governs opening a NEW account, not reading one that already
     * exists — `resolveScreen` serves those details read-only. Revoked details
     * still explain returned payments and offer support. A residence-gated row
     * always opens: the screen behind it states the rule, and a closed row
     * states nothing. A block from the corridor's own terms keeps the row open
     * too, for the same reason. So does identity verification — that row leads
     * to the verification flow.
     */
    const isOpenable = (corridor: DepositCorridor, view: DepositGateView) => {
        // The backend's own answer wins: it speaks for this user and this
        // corridor, where the gate speaks for the rail alone.
        const reason = reasonFor(corridor)
        if (reason === 'not-offered') return isHeld(accounts[corridor])
        if (reason !== undefined) return true
        return (
            isResidenceGated(corridor) ||
            !isClaimable(DEPOSIT_RAILS[corridor]) ||
            view.claimable ||
            (view.notice !== undefined && isDepositBlock(view.notice.kind)) ||
            isHeld(accounts[corridor]) ||
            // told nothing about this corridor, and the gate says identity:
            // that row leads to the verification flow
            gates[corridor]?.kind === 'needs-identity'
        )
    }

    const views = hubCorridors
        .filter((corridor) => matchesCorridor(corridor))
        // With the corridor's own terms: for a corridor the backend offers, those
        // terms decide, and the capability gate alone would call it closed.
        .map((corridor) => {
            const view = depositGateView(gates[corridor], claimable?.[corridor])
            return { corridor, view, openable: isOpenable(corridor, view) }
        })
        /*
         * A row the user cannot act on sits last. Hugo, on the greyed COP row
         * five of seven: "always have grey items at bottom". `sort` is stable,
         * so within each group the catalogue order holds and the list does not
         * reshuffle as the reads land.
         */
        .sort((a, b) => Number(b.openable) - Number(a.openable))

    /**
     * Where the corridor stands, in the one slot that carries status.
     *
     * A pointer row has no account and therefore no status: its badge would be
     * a claim about something that does not exist. The chevron already says it
     * leads somewhere, which is all a pointer row has to say.
     *
     * "Unavailable" is reserved for a corridor that is truly closed. A
     * residence-gated row is not closed — it is one residence away — so it
     * reads "Not set up" and the screen behind it carries the reason.
     */
    const rowBadge = (rail: DepositRail, account: DepositAccountView | undefined, gate: GateState) => {
        if (topUpOnlyHref(rail)) return null
        if (isLoading) return <div className="h-5 w-16 animate-pulse rounded bg-foreground-primary/10" />
        if (isResidenceGated(rail.corridor) && !account)
            return <StatusBadge status="custom" customText={t('list.badgeNotSetUp')} />
        // A claimable corridor the user has no rail for, shown because identity
        // verification comes first. The badge states the requirement and promises
        // nothing: verifying opens the corridors the user's region has, not all.
        //
        // Unless the user verified long ago. The gate answers `needs-identity`
        // for a corridor whose rail it cannot read as well, and telling a
        // verified user to verify is both false and a dead end — the row simply
        // is not offered to them.
        if (!account && (reasonFor(rail.corridor) !== undefined || gate.kind === 'needs-identity')) {
            const reason = reasonFor(rail.corridor)
            if (reason === 'not-offered') return <StatusBadge status="custom" customText={t('list.badgeNotOffered')} />
            // the app's one "contact support" string, so the badge cannot
            // drift from the buttons that do the same thing
            if (reason === 'support-required')
                return <StatusBadge status="custom" customText={tCommon('contactSupport')} />
            // `identity-required`, and the same for a corridor the backend said
            // nothing about whose gate reads `needs-identity`
            return <StatusBadge status="custom" customText={t('list.badgeVerify')} />
        }
        if (!isClaimable(rail) || account?.status === 'unavailable')
            return <StatusBadge status="custom" customText={t('list.badgeUnavailable')} />
        // A read that failed says nothing about what the user holds. "Not set
        // up" is a claim about their account, and the fallback map cannot make
        // it — the notice above owns this state.
        if (isError) return null
        if (account?.timedOut) return <StatusBadge status="failed" />
        // No account yet, and one is on its way: the provider is reviewing the
        // corridor and the row says so rather than "Not set up", which reads as
        // "nothing is happening" to a user who just asked for it.
        if (claimable?.[rail.corridor]?.blockedBy === 'endorsement-pending' && !account)
            return <StatusBadge status="pending" />
        // The review waits on the user. The user is verified already, so the row
        // says something is needed and the screen behind it says what.
        if (claimable?.[rail.corridor]?.blockedBy === 'endorsement-required' && !account)
            return <StatusBadge status="pending" customText={t('list.badgeActionNeeded')} />
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
     * A pointer row goes straight to its top-up flow, whatever the residence
     * says: Argentina has no account to open, and the flow states its own
     * verification rule. The country list sends Argentina to the same href, so
     * the two entry points cannot disagree.
     *
     * Everything else opens the corridor screens.
     */
    const openRow = (corridor: DepositCorridor) => {
        const topUp = topUpOnlyHref(DEPOSIT_RAILS[corridor])
        if (topUp) {
            // The Manteca top-up is a page of its own, so it must know where the
            // user came from — the hub — or leaving verification strands them on
            // the bare amount route they never knowingly opened.
            router.push(withReturnTo(rewriteMethodPath(topUp), '/add-money?method=bank'))
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
            leading={<IconBubble icon="coins" color="blue" size="s" />}
            onClick={() => router.push(CRYPTO_HREF)}
            data-testid="add-money-crypto"
        />
    ) : null
    /**
     * The account limit, shown as a live count so the user meets it as
     * information up front and not as a wall at claim time.
     *
     * The limit is per user — support can raise it — and the backend sends it.
     * An API deployed before that field still says when the limit is reached,
     * on every corridor on offer, so the fallback shows a number only where it
     * is known to be true: at the limit the limit IS the count, and below the
     * default the default holds. Past the default with room left, the limit was
     * raised to a number this screen cannot read, and it shows none.
     */
    const blockedByLimit = DEPOSIT_RAIL_ORDER.some((corridor) => claimable?.[corridor]?.blockedBy === 'account-limit')
    const accountLimit =
        userAccountLimit ??
        (blockedByLimit ? slotsHeld : slotsHeld < DEFAULT_ACCOUNT_LIMIT ? DEFAULT_ACCOUNT_LIMIT : undefined)
    const limitReached = accountLimit !== undefined && slotsHeld >= accountLimit
    /*
     * More accounts than the limit allows. It happens: support raised the limit
     * and lowered it again, or a lost account was adopted onto the user's row
     * after the fact. "3 of 2 used" and "You've used all 2 accounts" are both
     * wrong, so the count stands on its own and the note says what is true.
     */
    const overCap = accountLimit !== undefined && slotsHeld > accountLimit

    // A corridor with no row left after the search has nothing to label.
    const showAccounts = accountsEnabled && views.length > 0
    // hidden while the read is in flight or has failed — a count then is a guess
    const showCounter = !isLoading && !isError && accountLimit !== undefined
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
                    <Section
                        title={
                            // The count sits beside the heading so the pitch keeps the
                            // full width at 320px. MoreInfo is a real button: the
                            // reason opens on tap and from the keyboard.
                            <span className="flex items-center justify-between gap-2">
                                {t('list.sectionTitle')}
                                {showCounter && (
                                    <span className="flex shrink-0 items-center gap-1" data-testid="account-counter">
                                        <StatusBadge
                                            status="custom"
                                            customText={
                                                overCap
                                                    ? t('list.accountCounterOverCap', { used: slotsHeld })
                                                    : t('list.accountCounter', {
                                                          used: slotsHeld,
                                                          cap: accountLimit,
                                                      })
                                            }
                                        />
                                        <MoreInfo text={t('list.accountLimitWhy')} />
                                    </span>
                                )}
                            </span>
                        }
                        data-testid="your-accounts"
                    >
                        <p className="text-body-s text-foreground-secondary">{t('list.accountsPitch')}</p>
                        {/* Support opens more on request; the wording changes once
                            every slot is used so the counter and the note agree. */}
                        {showCounter && (
                            <p className="text-body-xs text-foreground-secondary">
                                {overCap
                                    ? t('list.accountLimitOverCap', { used: slotsHeld })
                                    : limitReached
                                      ? t('list.accountLimitReached', { cap: accountLimit })
                                      : t('list.accountLimitNote', { cap: accountLimit })}
                            </p>
                        )}
                        <ListGroup>
                            {views.map(({ corridor, openable }) => {
                                const rail = DEPOSIT_RAILS[corridor]
                                const account = accounts[corridor]
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
                                        trailing={rowBadge(rail, account, gates[corridor])}
                                        chevron={!disabled}
                                        disabled={disabled}
                                        onClick={() => openRow(corridor)}
                                        data-testid={`deposit-account-${corridor}`}
                                    />
                                )
                            })}
                            {cryptoRow}
                        </ListGroup>
                    </Section>
                )}

                {/*
                 * Every other way in. A country resolves to the corridor its
                 * rail catalogue names — the standing account opens above, the
                 * rest open their own flow — and a country with no live rail
                 * offers the waitlist rather than a screen that says "soon".
                 */}
                {showCountries && (
                    <ListGroup data-testid="other-countries">
                        {/* the same row the accounts card is built from: an
                            accordion with one bottom border read as a broken
                            row next to them */}
                        <ListItem
                            title={t('list.countriesTitle')}
                            body={t('list.countriesPitch')}
                            bodyWrap
                            leading={<IconBubble icon="globe" color="blue" size="s" />}
                            trailing={
                                <Icon
                                    name="chevron-down"
                                    size={20}
                                    className={twMerge(
                                        'transition-transform duration-moderate',
                                        countriesExpanded && 'rotate-180'
                                    )}
                                />
                            }
                            position={countriesExpanded ? 'first' : 'single'}
                            aria-expanded={countriesExpanded}
                            onClick={() => setCountriesOpen(!countriesExpanded)}
                            data-testid="other-countries-toggle"
                        />
                        {countriesExpanded && (
                            <CountryList
                                viewMode="add-withdraw"
                                flow="add"
                                searchTerm={query}
                                onCountryClick={openCountry}
                                isCountrySupported={isCountrySupported}
                                continuesGroup
                            />
                        )}
                    </ListGroup>
                )}

                {/* Crypto comes after the bank options, not before them: with no
                    accounts card to carry its row, it sits below the countries so
                    the hub does not lead with crypto. */}
                {!showAccounts && cryptoRow && <ListGroup>{cryptoRow}</ListGroup>}
            </div>
        </PageStack>
    )
}
