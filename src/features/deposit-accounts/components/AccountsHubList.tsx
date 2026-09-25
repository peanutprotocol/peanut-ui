'use client'

import { Accordion } from '@/components/0_Bruddle/Accordion'
import { Callout } from '@/components/0_Bruddle/Callout'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Section } from '@/components/0_Bruddle/Section'
import Badge from '@/components/Global/Badges/Badge'
import MoreInfo from '@/components/Global/MoreInfo'
import { rowStatusBadge } from '@/components/Profile/views/RowStatusBadge'
import { twMerge } from '@/utils/tw'
import type { UnlockRow } from '@/utils/unlock-payments.utils'
import { useLocale, useTranslations } from 'next-intl'
import { useState, type ReactElement, type ReactNode } from 'react'
import { offersVerification } from '../depositGate'
import {
    closedBankRow,
    closedOpenRow,
    corridorMatchesSearch,
    otherWaysRows,
    virtualAccountRows,
    type ClosedRow,
    type HubAccounts,
    type OpenAccountRow,
} from '../hubRows'
import { DEFAULT_ACCOUNT_LIMIT, DEPOSIT_RAILS, DEPOSIT_RAIL_ORDER, isClaimable } from '../rails'
import { canShare } from '../resolveScreen'
import { SKELETON_PULSE } from '../skeleton'
import type { DepositCorridor } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { ClosedRowDrawer } from './ClosedRowDrawer'
import { CorridorFlag } from './CorridorFlag'

/**
 * The one list of ways money gets into Peanut, shared by Add money and the
 * profile Accounts page (Hugo, 2026-09-24: Add money is a subset of Accounts,
 * with one copy and one design).
 *
 * Three sections: the accounts the user holds, the ones they could open, and
 * the other ways — bank rails and, on Add money, crypto and the countries.
 * Once the user holds an account, the ones they could open fold into one
 * closed row at the foot of the held list, one card with it (Hugo,
 * 2026-09-25): a list of "Not set up" rows under a held account read as a
 * checklist, and working through it runs into the account limit. It lists
 * every account the user does not hold; one they cannot open says why on tap,
 * the limit first (Hugo, 2026-09-25). Each screen decides what a tap does; the rows, their order, their
 * words and the reason behind a row that cannot be used are the same on both.
 * A row is titled by its currency alone; the rail's name is on the screen or
 * drawer behind the tap.
 */
export function AccountsHubList({
    accounts,
    claimsEnabled,
    bankRows,
    onBankRowClick,
    onChangeResidence,
    isKycDegraded = false,
    searchTerm = '',
    extraRows = [],
    footer,
}: {
    /** absent where the virtual accounts are not read (their rollout flag is off) */
    accounts?: HubAccounts
    /** may a new virtual account be opened — the rollout flag */
    claimsEnabled: boolean
    /** `useBankRows().rows` */
    bankRows: UnlockRow[]
    /** a bank row the user can use or unlock */
    onBankRowClick: (row: UnlockRow) => void
    onChangeResidence: () => void
    /** verification is down, so a bank row that needs it explains that instead */
    isKycDegraded?: boolean
    /** filters every row; the caller owns the field */
    searchTerm?: string
    /** rows the caller appends to the other ways (crypto) */
    extraRows?: ReactElement[]
    /** under the other ways (the countries accordion) */
    footer?: ReactNode
}) {
    const { t, railName } = useDepositAccountCopy()
    const tRows = useTranslations('profile.unlockPayments')
    const tCommon = useTranslations('common')
    const locale = useLocale()
    const [closed, setClosed] = useState<ClosedRow | null>(null)

    const isLoading = !!accounts?.isLoading
    const isError = !!accounts?.isError
    const matches = (corridor: DepositCorridor, name: string) =>
        corridorMatchesSearch(corridor, searchTerm, locale, name)

    const { held, open } = accounts ? virtualAccountRows(accounts, claimsEnabled) : { held: [], open: [] }
    const shownHeld = held.filter((corridor) => matches(corridor, railName(corridor)))
    const shownOpen = open.filter((row) => matches(row.corridor, railName(row.corridor)))
    // A search shows every match, so the fold steps aside while the user types
    // (the countries row on Add money does the same).
    const searching = !!searchTerm.trim()

    // An active virtual account covers its currency, so the bank row for it goes.
    const activeCurrencies = new Set(
        held
            .filter((corridor) => accounts?.accounts[corridor]?.status === 'active')
            .map((corridor) => DEPOSIT_RAILS[corridor].currency)
    )
    const shownBankRows = otherWaysRows(bankRows, activeCurrencies).filter(
        (row) => !row.corridor || matches(row.corridor, tRows(`rows.${row.labelKey}`))
    )

    const heldBadge = (corridor: DepositCorridor) => {
        const account = accounts?.accounts[corridor]
        if (account?.status === 'unavailable') return <Badge status="neutral" customText={t('list.badgeNotOffered')} />
        if (account?.timedOut) return <Badge status="failed" />
        switch (account?.status) {
            case 'active':
            case 'retiring':
                // "Ready" means a payer can be handed these details today — the
                // same answer the details footer gives
                return (
                    <Badge
                        status="completed"
                        customText={
                            accounts && canShare(account, accounts.gates[corridor])
                                ? t('list.badgeReady')
                                : t('list.badgeActive')
                        }
                    />
                )
            case 'provisioning':
                return <Badge status="pending" />
            case 'revoked':
                return <Badge status="closed" customText={t('list.badgeRevoked')} />
            default:
                return null
        }
    }

    /** Where an account the user could open stands. A fact with no tone is `neutral` (Konrad, 2026-09-23). */
    const openBadge = ({ corridor, openable, unchecked }: OpenAccountRow) => {
        // at the limit the cap is the answer for every row, before any other reason
        if (capFirst(corridor)) return <Badge status="neutral" customText={t('list.badgeLimitReached')} />
        const reason = accounts?.unavailable?.[corridor]?.reason
        // the app's one "contact support" string, so the badge cannot drift
        // from the buttons that do the same thing
        if (reason === 'support-required') return <Badge status="neutral" customText={tCommon('contactSupport')} />
        if (reason === 'identity-required' || (reason === undefined && offersVerification(accounts?.gates[corridor])))
            return <Badge status="pending" customText={t('list.badgeVerify')} />
        // a read that failed says nothing about what the user holds; the notice above owns it
        if (isError) return null
        if (unchecked) return <Badge status="neutral" customText={tCommon('status.unknown')} />
        if (!openable) return <Badge status="neutral" customText={t('list.badgeNotOffered')} />
        switch (accounts?.claimable?.[corridor]?.blockedBy) {
            // the provider is reviewing the corridor the user asked for
            case 'endorsement-pending':
                return <Badge status="pending" />
            // the review waits on the user; the screen behind says what is needed
            case 'endorsement-required':
                return <Badge status="pending" customText={t('list.badgeActionNeeded')} />
            // the tap explains the limit and offers support
            case 'account-limit':
                return <Badge status="neutral" customText={t('list.badgeLimitReached')} />
        }
        return <Badge status="neutral" customText={t('list.badgeNotSetUp')} />
    }

    /*
     * The account limit, as a live count beside the heading. The limit is per
     * user — support can raise it — and the backend sends it. An API deployed
     * before that field still says when the limit is reached, so the fallback
     * shows a number only where it is known to be true: at the limit the limit
     * IS the count, and below the default the default holds.
     */
    const slotsHeld = accounts?.slotsHeld ?? 0
    const blockedByLimit = DEPOSIT_RAIL_ORDER.some(
        (corridor) => accounts?.claimable?.[corridor]?.blockedBy === 'account-limit'
    )
    const accountLimit =
        accounts?.accountLimit ??
        (blockedByLimit ? slotsHeld : slotsHeld < DEFAULT_ACCOUNT_LIMIT ? DEFAULT_ACCOUNT_LIMIT : undefined)
    // more accounts than the limit, after support lowered it: the count stands alone
    const overCap = accountLimit !== undefined && slotsHeld > accountLimit
    const atLimit = accountLimit !== undefined && slotsHeld >= accountLimit
    /*
     * At the limit nothing opens, whatever else holds a row back (chip,
     * ui#3479): a support or verification block cleared alone would still not
     * open a third account. The one exception is a row the backend itself
     * flags at the limit, which keeps the claim step's own limit screen.
     */
    const capFirst = (corridor: DepositCorridor) =>
        atLimit && accounts?.claimable?.[corridor]?.blockedBy !== 'account-limit'
    // the fold sits under the held rows; a search lists every match instead
    const foldOpen = held.length > 0 && !searching
    const counter =
        claimsEnabled && !isError && accountLimit !== undefined ? (
            <span className="flex shrink-0 items-center gap-1" data-testid="account-counter">
                <Badge
                    status="neutral"
                    customText={
                        overCap
                            ? t('list.accountCounterOverCap', { used: slotsHeld })
                            : t('list.accountCounter', { used: slotsHeld, cap: accountLimit })
                    }
                />
                <MoreInfo text={t('list.accountLimitWhy')} aria-label={t('list.accountLimitWhyLabel')} />
            </span>
        ) : undefined

    // the loaded rows' own shape, so the swap does not jump (design.md, skeletons)
    const skeletonRows = (count: number) =>
        Array.from({ length: count }, (_, index) => (
            <ListItem
                key={`skeleton-${index}`}
                leading={<div className={twMerge(SKELETON_PULSE, 'size-8 rounded-full')} />}
                title={<div className={twMerge(SKELETON_PULSE, 'h-4 w-12')} />}
            />
        ))

    const accountRow = (
        corridor: DepositCorridor,
        badge: ReactNode,
        onClick: () => void,
        position?: 'middle' | 'bottom'
    ) => (
        <ListItem
            key={corridor}
            position={position}
            leading={<CorridorFlag iso2={DEPOSIT_RAILS[corridor].flagIso2} />}
            title={DEPOSIT_RAILS[corridor].currency}
            trailing={badge}
            chevron={!isError}
            disabled={isError}
            onClick={onClick}
            data-testid={`deposit-account-${corridor}`}
        />
    )

    const bankRow = (row: UnlockRow) => {
        const label = tRows(`rows.${row.labelKey}`)
        return (
            <ListItem
                key={row.id}
                // a bank row with no country flag still names a bank
                leading={row.flag ? <CorridorFlag iso2={row.flag} /> : <IconBubble {...CONCEPT_ICONS.bank} size="s" />}
                title={row.currency ?? label}
                trailing={rowStatusBadge(row, tRows)}
                body={row.note && tRows(row.note)}
                bodyWrap
                chevron
                onClick={() => {
                    const reason = closedBankRow(row, isKycDegraded)
                    if (reason) setClosed(reason)
                    else onBankRowClick(row)
                }}
                data-testid={`bank-row-${row.labelKey}`}
            />
        )
    }

    // Until the accounts are read, the bank rows cannot be deduped against them,
    // so they wait behind skeletons with the accounts.
    const otherWays = [...(isLoading ? skeletonRows(bankRows.length) : shownBankRows.map(bankRow)), ...extraRows]
    // In the fold the rows sit inside the item's own border, under the line
    // the content draws below the trigger: no row brings a top border of its
    // own, so no two borders meet.
    const openRows = (inFold: boolean) => (
        <ListGroup>
            {shownOpen.map((row, index) =>
                accountRow(
                    row.corridor,
                    openBadge(row),
                    () =>
                        row.openable && !capFirst(row.corridor)
                            ? accounts?.onOpen(row.corridor)
                            : setClosed(
                                  closedOpenRow(row, {
                                      reachedLimit: atLimit ? accountLimit : undefined,
                                  })
                              ),
                    inFold ? (index === shownOpen.length - 1 ? 'bottom' : 'middle') : undefined
                )
            )}
        </ListGroup>
    )
    const heldRows = shownHeld.map((corridor) =>
        accountRow(corridor, heldBadge(corridor), () => accounts?.onOpen(corridor))
    )
    const showFold = foldOpen && shownOpen.length > 0
    const accountSkeletons = isLoading
        ? (accounts?.corridors.filter((corridor) => isClaimable(DEPOSIT_RAILS[corridor])).length ?? 0)
        : 0

    return (
        <>
            {/* A read that failed is not "you hold nothing": without this the
                empty fallback map reads as accounts never opened. */}
            {accounts?.isError && (
                <Callout
                    priority="error"
                    title={t('list.errorTitle')}
                    ctas={[{ label: t('list.errorRetry'), onClick: accounts.onRetry }]}
                >
                    {t('list.errorBody')}
                </Callout>
            )}

            {accountSkeletons > 0 && <ListGroup>{skeletonRows(accountSkeletons)}</ListGroup>}

            {!isLoading && shownHeld.length > 0 && (
                <Section title={t('list.heldTitle')} trailing={counter} data-testid="virtual-accounts">
                    {showFold ? (
                        // one card: the held rows, then the fold as its last item
                        <Accordion type="single" collapsible>
                            <ListGroup>
                                {heldRows}
                                <Accordion.Item value="open" data-testid="open-accounts-item">
                                    <Accordion.Trigger
                                        leading={<IconBubble {...CONCEPT_ICONS.bank} size="s" />}
                                        title={t('list.openTitle')}
                                        data-testid="open-accounts-toggle"
                                    />
                                    <Accordion.Content flush data-testid="open-virtual-accounts">
                                        {openRows(true)}
                                    </Accordion.Content>
                                </Accordion.Item>
                            </ListGroup>
                        </Accordion>
                    ) : (
                        <ListGroup>{heldRows}</ListGroup>
                    )}
                </Section>
            )}

            {!isLoading && !foldOpen && shownOpen.length > 0 && (
                <Section title={t('list.openTitle')} data-testid="open-virtual-accounts">
                    {openRows(false)}
                </Section>
            )}

            {(otherWays.length > 0 || footer) && (
                <Section title={t('list.otherWaysTitle')} data-testid="other-ways">
                    <p className="text-body-s text-foreground-secondary">{t('list.otherWaysBody')}</p>
                    {otherWays.length > 0 && <ListGroup>{otherWays}</ListGroup>}
                    {footer}
                </Section>
            )}

            <ClosedRowDrawer
                closed={closed}
                onClose={() => setClosed(null)}
                onChangeResidence={onChangeResidence}
                onRetry={accounts?.onRetry}
            />
        </>
    )
}
