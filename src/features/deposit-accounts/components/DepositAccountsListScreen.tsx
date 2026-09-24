'use client'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Callout } from '@/components/0_Bruddle/Callout'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { CountryList } from '@/components/Common/CountryList'
import Badge from '@/components/Global/Badges/Badge'
import { Icon } from '@/components/Global/Icons/Icon'
import MoreInfo from '@/components/Global/MoreInfo'
import NavHeader from '@/components/Global/NavHeader'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import type { GateState } from '@/utils/capability-gate'
import { rewriteMethodPath } from '@/utils/native-routes'
import { withReturnTo } from '@/utils/return-to.utils'
import { twMerge } from '@/utils/tw'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { parseAsStringEnum, useQueryStates } from 'nuqs'
import { useMemo, useState } from 'react'
import { corridorHasTopUp } from '@/features/add-money/countryRoutes'
import { depositGateView, isDepositBlock, offersVerification, type DepositGateView } from '../depositGate'
import { DEFAULT_ACCOUNT_LIMIT, DEPOSIT_RAILS, DEPOSIT_RAIL_ORDER, isClaimable, topUpOnlyHref } from '../rails'
import { isResidenceGated, RESIDENCE_GATED_CORRIDORS } from '../residenceGate'
import { canShare, isHeld } from '../resolveScreen'
import type { ClaimableCorridor, UnavailableCorridor, DepositAccountView, DepositCorridor, DepositRail } from '../types'
import { SKELETON_PULSE } from '../skeleton'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { useDepositAccountsEnabled } from '../useDepositAccountsEnabled'
import { useDepositCountryRouting } from '../useDepositCountryRouting'
import { CorridorFlag } from './CorridorFlag'

/** the corridors whose row is a one-off transfer, each with its own line of copy */
type OneOffCorridor = 'BANK_TRANSFER_AR' | 'PIX_BR'

/** the crypto entry point, reached from this screen and from the home Add drawer */
const CRYPTO_HREF = '/add-money/crypto'

/**
 * The hub: the accounts this user holds or can claim, and every country they
 * can send money in from.
 *
 * Both jobs are one screen because they were one question: "how does money get
 * into my balance by bank". Add money entered by country and get-paid entered
 * by account, and the two lists disagreed about what a country offered. The
 * accounts come first — they are the reusable answer. Below them, "Add money
 * from your bank" holds the one-off transfers (Argentina, Brazil), which have
 * no account number to share, and the other countries, each sent to the route
 * its rail catalogue names. Only that list is searchable: a search field over
 * the whole screen was clutter (Konrad, 2026-09-23).
 *
 * The rows come from the user's own rails, so a corridor they have no rail for
 * is absent rather than present and unavailable — a German user reading an
 * "Not available" ARS row learns nothing and doubts the four rows above it.
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
    const router = useRouter()
    const { openCountry, isCountrySupported } = useDepositCountryRouting({
        accounts,
        claimable,
        unavailable,
        isLoading,
    })
    // The flag gates opening an account, not reading one. While it is off the
    // rows are the accounts the user already holds and nothing else: their
    // details are in payers' records and money keeps landing on them, so they
    // stay readable; a corridor on offer, the counter and the cap note are
    // about opening more, and go dark with the flag.
    const claimsEnabled = useDepositAccountsEnabled()
    // The home drawer already asked bank or crypto, and `?method=bank` is that
    // answer. Offering crypto again here is the question the user just settled.
    const [{ method }] = useQueryStates({ method: parseAsStringEnum(['bank']) })

    // The country list, and the search that lives in it, opens on a tap.
    const [countriesOpen, setCountriesOpen] = useState(false)

    // The crypto row is gone where the home drawer already settled bank.
    const showCrypto = !method

    /**
     * The account rows: this user's own corridors, plus the residence-gated
     * ones, which everybody sees. A Brazilian account is worth knowing about
     * before you live in Brazil, and the screen behind the row is what states
     * the rule.
     *
     * A one-off transfer (Argentina, Brazil's Pix) is never an account number,
     * so it is not listed here — see `oneOffCorridors`.
     *
     * A corridor the backend has said NOTHING about gets no row. The hub used
     * to add every claimable corridor in the catalogue whose gate read
     * `needs-identity`, badged "Requires verification". The gate answers
     * `needs-identity` for "no functional rail in scope and identity not
     * verified", which is also its answer for a corridor this user's world has
     * never contained — so the hub promised Colombia to a user no Colombian
     * rail exists for, and the row vanished the moment they verified. That is a
     * row naming an action the user cannot take, and then unnaming it.
     *
     * Nothing is lost by dropping it. A corridor the backend offers is in
     * `claimable`, one it withholds is in `unavailable`, one the user holds is
     * in `accounts`, and each of the three is already a row — with the identity
     * gate still reading `needs-identity` on it, still badged, still tapping
     * through to verification. Only the corridors nobody mentioned go quiet,
     * and silence is the honest answer to silence: "Not available" would be a
     * claim about this user that the backend never made either.
     */
    const hubCorridors = useMemo(() => {
        const shown = new Set([...corridors, ...RESIDENCE_GATED_CORRIDORS])
        return DEPOSIT_RAIL_ORDER.filter(
            (corridor) =>
                shown.has(corridor) &&
                !topUpOnlyHref(DEPOSIT_RAILS[corridor]) &&
                (claimsEnabled || isHeld(accounts[corridor]))
        )
    }, [corridors, claimsEnabled, accounts])

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
     * Can this user take the other way into this corridor — the transfer they
     * send themselves from their own bank?
     *
     * Two things have to be true. The corridor needs a country live for it:
     * Colombia has none, so no row may offer one. And the user's verification
     * has to permit the corridor, which is what a `ready` gate means. The
     * transfer needs no ACCOUNT and no free account slot, but it is not open to
     * everybody — `POST /bridge/onramp/create` refuses a user with no enabled
     * rail for it. Offering it to them would be the same dead end in mirror
     * image.
     */
    const canTopUp = (corridor: DepositCorridor) => corridorHasTopUp(corridor) && gates[corridor]?.kind === 'ready'

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
            // The user can send themselves a transfer on this corridor,
            // whatever the standing account says. That way in needs no account,
            // so a row that leads to it is never a dead end.
            canTopUp(corridor) ||
            // told nothing about this corridor, and the gate names a
            // verification step: that row leads to the flow that clears it
            offersVerification(gates[corridor])
        )
    }

    const views = hubCorridors
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
     * A badge states status only. A fact with no tone — "Not set up", a dead
     * end — takes `neutral`, never `custom`, whose accent colour belongs to
     * nothing on this screen (Konrad, 2026-09-23).
     *
     * "Not available" is reserved for a corridor that is truly closed —
     * one label, whether it is not offered here or not open yet. A
     * residence-gated row is not closed — it is one residence away — so it
     * reads "Not set up" and the screen behind it carries the reason.
     *
     * "Not set up" may only appear where the user can set one up. Where they
     * cannot — the account cap is reached, or the rail is not theirs yet — but
     * the corridor still takes a transfer they send themselves, the row reads
     * "Available", because that is what is true of the corridor today.
     */
    const rowBadge = (
        rail: DepositRail,
        account: DepositAccountView | undefined,
        gate: GateState,
        view: DepositGateView
    ) => {
        if (isLoading) return <div className={twMerge(SKELETON_PULSE, 'h-5 w-16')} />
        if (isResidenceGated(rail.corridor) && !account)
            return <Badge status="neutral" customText={t('list.badgeNotSetUp')} />
        // A claimable corridor the user has no rail for, shown because identity
        // verification comes first. The badge states the requirement and promises
        // nothing: verifying opens the corridors the user's region has, not all.
        //
        // Unless the user verified long ago. The gate answers `needs-identity`
        // for a corridor whose rail it cannot read as well, and telling a
        // verified user to verify is both false and a dead end — the row simply
        // is not offered to them.
        if (!account && (reasonFor(rail.corridor) !== undefined || offersVerification(gate))) {
            const reason = reasonFor(rail.corridor)
            if (reason === 'not-offered') return <Badge status="neutral" customText={t('list.badgeNotOffered')} />
            // the app's one "contact support" string, so the badge cannot
            // drift from the buttons that do the same thing
            if (reason === 'support-required') return <Badge status="neutral" customText={tCommon('contactSupport')} />
            // `identity-required`, and the same for a corridor the backend said
            // nothing about whose gate names a verification step: the user has
            // something to do, as with "Action needed"
            return <Badge status="pending" customText={t('list.badgeVerify')} />
        }
        if (!isClaimable(rail) || account?.status === 'unavailable')
            return <Badge status="neutral" customText={t('list.badgeNotOffered')} />
        // A read that failed says nothing about what the user holds. "Not set
        // up" is a claim about their account, and the fallback map cannot make
        // it — the notice above owns this state.
        if (isError) return null
        if (account?.timedOut) return <Badge status="failed" />
        // No account yet, and one is on its way: the provider is reviewing the
        // corridor and the row says so rather than "Not set up", which reads as
        // "nothing is happening" to a user who just asked for it.
        if (claimable?.[rail.corridor]?.blockedBy === 'endorsement-pending' && !account)
            return <Badge status="pending" />
        // The review waits on the user. The user is verified already, so the row
        // says something is needed and the screen behind it says what.
        if (claimable?.[rail.corridor]?.blockedBy === 'endorsement-required' && !account)
            return <Badge status="pending" customText={t('list.badgeActionNeeded')} />
        switch (account?.status) {
            case 'active':
            case 'retiring':
                return (
                    <Badge
                        status="completed"
                        // "Ready" means a payer can be handed these details
                        // today — the same answer the details footer gives
                        customText={canShare(account, gate) ? t('list.badgeReady') : t('list.badgeActive')}
                    />
                )
            case 'provisioning':
                return <Badge status="pending" />
            case 'revoked':
                return <Badge status="closed" customText={t('list.badgeRevoked')} />
            default:
                // "Not set up" claims the user can set one up. Where they
                // cannot — the account cap is reached, the provider is still
                // reviewing, the rail is not theirs yet — but the corridor
                // still takes a transfer they send themselves, the row reports
                // that instead. It is the case a user at the cap met: a row
                // that said "Not set up" on a corridor accepting money that
                // same second, with no way in behind it.
                if (!view.claimable && canTopUp(rail.corridor))
                    return <Badge status="completed" customText={t('list.badgeAvailable')} />
                return <Badge status="neutral" customText={t('list.badgeNotSetUp')} />
        }
    }

    /**
     * The one-off transfers: Argentina and Brazil's Pix. There is no account
     * behind them, only a transfer the user makes each time, so they are not
     * account numbers and sit under "Add money from your bank".
     *
     * A row shows only where it leads somewhere: the user can use it now, or
     * the verification flow can open it. It carries no badge while it simply
     * works — "Available" on a row that has no account is no status — and
     * "Requires verification" where that is the next step. For anyone else it
     * is absent: its own flow would only tell them it is not for them.
     */
    const oneOffCorridors = claimsEnabled
        ? DEPOSIT_RAIL_ORDER.filter(
              (corridor) =>
                  !!topUpOnlyHref(DEPOSIT_RAILS[corridor]) &&
                  (canTopUp(corridor) || offersVerification(gates[corridor]))
          )
        : []

    // The top-up flow is a page of its own, so it must know where the user
    // came from — the hub — or leaving verification strands them on the bare
    // amount route they never knowingly opened.
    const openOneOff = (href: string) => router.push(withReturnTo(rewriteMethodPath(href), '/add-money?method=bank'))

    /**
     * The KYC-free way in, and the only one that is not a country. It is a row
     * of the accounts card rather than a box of its own: three stacked cards
     * read as three unrelated screens.
     */
    const cryptoRow = showCrypto ? (
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

    // A section with no rows has nothing to label.
    const showAccounts = views.length > 0
    // hidden while the read is in flight or has failed — a count then is a guess
    const showCounter = claimsEnabled && !isLoading && !isError && accountLimit !== undefined

    return (
        <PageStack>
            <NavHeader title={t('list.addTitle')} onPrev={onBack} />
            <div className="flex flex-col gap-4">
                <TitleBlock title={t('list.addHeading')} />

                {/*
                 * A read that failed is not "you hold nothing". Without this the
                 * empty fallback map renders as six unclaimed corridors and the
                 * user is invited to open an account they may already have.
                 */}
                {isError && (
                    <Callout
                        priority="error"
                        title={t('list.errorTitle')}
                        ctas={[{ label: t('list.errorRetry'), onClick: onRetry }]}
                    >
                        {t('list.errorBody')}
                    </Callout>
                )}

                {showAccounts && (
                    <Section
                        title={t('list.sectionTitle')}
                        // The count sits beside the heading so the pitch keeps the
                        // full width at 320px. It is the Section's trailing slot, a
                        // sibling of the heading, so the heading's name stays the
                        // title alone. MoreInfo is a real, named button: the reason
                        // opens on tap and from the keyboard.
                        trailing={
                            showCounter ? (
                                <span className="flex shrink-0 items-center gap-1" data-testid="account-counter">
                                    <Badge
                                        status="neutral"
                                        customText={
                                            overCap
                                                ? t('list.accountCounterOverCap', { used: slotsHeld })
                                                : t('list.accountCounter', {
                                                      used: slotsHeld,
                                                      cap: accountLimit,
                                                  })
                                        }
                                    />
                                    <MoreInfo
                                        text={t('list.accountLimitWhy')}
                                        aria-label={t('list.accountLimitWhyLabel')}
                                    />
                                </span>
                            ) : undefined
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
                            {views.map(({ corridor, view, openable }) => {
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
                                        trailing={rowBadge(rail, account, gates[corridor], view)}
                                        chevron={!disabled}
                                        disabled={disabled}
                                        onClick={() => onOpen(corridor)}
                                        data-testid={`deposit-account-${corridor}`}
                                    />
                                )
                            })}
                            {cryptoRow}
                        </ListGroup>
                    </Section>
                )}

                {/*
                 * Every other way in by bank. The one-off transfers come first,
                 * then the other countries: a country resolves to the corridor
                 * its rail catalogue names — the standing account opens above,
                 * the rest open their own flow — and a country with no live rail
                 * offers the waitlist rather than a screen that says "soon". The
                 * country search lives inside the open list, not over the page.
                 */}
                <Section title={t('list.bankTopUpTitle')} data-testid="bank-top-up">
                    <ListGroup data-testid="other-countries">
                        {oneOffCorridors.map((corridor) => {
                            const rail = DEPOSIT_RAILS[corridor]
                            const href = topUpOnlyHref(rail) as string
                            return (
                                <ListItem
                                    key={corridor}
                                    leading={<CorridorFlag iso2={rail.flagIso2} />}
                                    title={<span>{`${rail.currency} · ${railName(corridor)}`}</span>}
                                    body={t(`list.oneOffBody.${corridor as OneOffCorridor}`)}
                                    bodyWrap
                                    trailing={
                                        canTopUp(corridor) ? undefined : (
                                            <Badge status="pending" customText={t('list.badgeVerify')} />
                                        )
                                    }
                                    chevron={!isLoading}
                                    disabled={isLoading}
                                    onClick={() => openOneOff(href)}
                                    data-testid={`deposit-account-${corridor}`}
                                />
                            )
                        })}
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
                                        countriesOpen && 'rotate-180'
                                    )}
                                />
                            }
                            aria-expanded={countriesOpen}
                            onClick={() => setCountriesOpen(!countriesOpen)}
                            data-testid="other-countries-toggle"
                        />
                    </ListGroup>
                    {countriesOpen && (
                        <CountryList
                            viewMode="add-withdraw"
                            flow="add"
                            onCountryClick={openCountry}
                            isCountrySupported={isCountrySupported}
                        />
                    )}
                </Section>

                {/* Crypto comes after the bank options, not before them: with no
                    accounts card to carry its row, it sits below the countries so
                    the hub does not lead with crypto. */}
                {!showAccounts && cryptoRow && <ListGroup>{cryptoRow}</ListGroup>}
            </div>
        </PageStack>
    )
}
