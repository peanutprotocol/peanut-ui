'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Accordion } from '@/components/0_Bruddle/Accordion'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { countryData } from '@/components/AddMoney/consts'
import { SearchInput } from '@/components/SearchInput'
import { matchesCountryQuery } from '@/components/Common/country-search'
import Badge from '@/components/Global/Badges/Badge'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { openBrazilPausedDrawer } from '@/features/brazil-pause/brazil-paused-drawer-store'
import { ClosedRowDrawer } from '@/features/deposit-accounts/components/ClosedRowDrawer'
import { CorridorFlag } from '@/features/deposit-accounts/components/CorridorFlag'
import { closedOpenRow, virtualAccountRows, type ClosedRow } from '@/features/deposit-accounts/hubRows'
import { DEPOSIT_RAIL_ORDER, DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import { isHeld } from '@/features/deposit-accounts/resolveScreen'
import { residenceAllows } from '@/features/deposit-accounts/residenceGate'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
import { liveRailsForCountry } from '@/features/destinations/country-rails'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useReturnTo } from '@/hooks/useSafeBack'
import type { GateState } from '@/utils/capability-gate'
import { rewriteMethodPath } from '@/utils/native-routes'
import { readReturnTo, withReturnTo } from '@/utils/return-to.utils'
import { localizedCountryTitle } from '@/utils/country-name.utils'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs'
import { useEffect, useRef, useState } from 'react'
import { trackAddMoney } from './analytics'
import { corridorTopUpHref } from './countryRoutes'
import { useAddMoneyReadiness } from './useAddMoneyReadiness'

const FIAT_METHODS = ['account', 'transfer', 'pix'] as const
const TRANSFER_COUNTRIES = countryData.flatMap((country) => {
    if (country.type !== 'country' || country.path === 'brazil') return []
    const href = liveRailsForCountry(country.id, 'add')[0]?.path
    return href ? [{ country, href }] : []
})

export function AddMoneyOptions() {
    const [{ method, ready, returnTo }] = useQueryStates({
        method: parseAsStringEnum([...FIAT_METHODS]),
        ready: parseAsStringEnum(['1']),
        returnTo: parseAsString,
    })
    const router = useRouter()
    const t = useTranslations('addMoney.methods')
    const tAccounts = useTranslations('depositAccounts')
    const tProfile = useTranslations('profile.unlockPayments')
    const readyOnly = ready === '1'
    const origin = readReturnTo(new URLSearchParams(returnTo ? { returnTo } : {}), '/add-money/options')
    const back = useReturnTo(origin ?? (readyOnly ? '/home' : '/add-money'))
    const readiness = useAddMoneyReadiness(false, method === 'account' || readyOnly)
    const deposit = useDepositAccounts({ enabled: method === 'account' })
    const { isTerminalFailure } = useIdentityVerification()
    const { residenceIso2s, brazilPaused, standingEnabled } = readiness
    const [countriesOpen, setCountriesOpen] = useState(false)
    const [countrySearch, setCountrySearch] = useState('')
    const locale = useLocale()
    const tSearch = useTranslations('withdraw.currencyList')
    const viewed = useRef(false)
    const [accountClosed, setAccountClosed] = useState<ClosedRow | null>(null)
    const [restricted, setRestricted] = useState<'PIX_BR' | 'BANK_TRANSFER_AR' | null>(null)

    const fallback =
        origin?.split(/[?#]/)[0] === '/add-money' ? origin : origin ? withReturnTo('/add-money', origin) : '/add-money'
    const selected = method ? readiness.ready[method] : []
    const emptyReady = readyOnly && !readiness.isLoading && selected.length === 0
    const canOpenAccount = standingEnabled || DEPOSIT_RAIL_ORDER.some((corridor) => isHeld(deposit.accounts[corridor]))
    const unavailableAccount = method === 'account' && !deposit.isLoading && !deposit.isError && !canOpenAccount
    useEffect(() => {
        if (!method || emptyReady || unavailableAccount) router.replace(fallback)
    }, [method, emptyReady, unavailableAccount, fallback, router])
    useEffect(() => {
        if (restricted && residenceAllows(restricted, residenceIso2s)) setRestricted(null)
    }, [restricted, residenceIso2s])
    useEffect(() => {
        if (!readyOnly || !method || readiness.isLoading || emptyReady || viewed.current) return
        viewed.current = true
        trackAddMoney(ANALYTICS_EVENTS.ADD_MONEY_VIEWED)
    }, [emptyReady, method, readiness.isLoading, readyOnly])
    if (!method || emptyReady || unavailableAccount) return null

    const chooser = `/add-money/options?method=${method}${readyOnly ? '&ready=1' : ''}`
    const returnHere = origin ? withReturnTo(chooser, origin) : chooser
    const changeResidence = () => router.push(withReturnTo('/settings/details?open=residence', returnHere))
    const trackCurrency = (corridor: DepositCorridor, href?: string) => {
        const slug = href?.split('/')[2]
        const country = countryData.find(
            (item) =>
                item.type === 'country' &&
                (item.path === slug || item.iso2?.toLowerCase() === DEPOSIT_RAILS[corridor].flagIso2)
        )
        if (country)
            trackAddMoney(ANALYTICS_EVENTS.DEPOSIT_METHOD_SELECTED, { method_type: 'bank', country: country.path })
    }
    const title =
        method === 'account'
            ? readyOnly
                ? tProfile('titles.bank')
                : t('openAccount')
            : method === 'transfer'
              ? t('oneTimeTransfer')
              : t('payPix')
    const { held, open } =
        method === 'account'
            ? virtualAccountRows(deposit, standingEnabled && !readyOnly, isTerminalFailure)
            : { held: [], open: [] }
    const heldRows = readyOnly ? held.filter((corridor) => selected.includes(DEPOSIT_RAILS[corridor].currency)) : held
    const openAccount = (corridor: DepositCorridor) => {
        trackCurrency(corridor, corridorTopUpHref(corridor, residenceIso2s))
        const step = isHeld(deposit.accounts[corridor]) ? 'details' : 'claim'
        router.push(withReturnTo(`/add-money?method=bank&corridor=${corridor}&step=${step}`, returnHere))
    }
    const transferRows =
        method === 'account'
            ? []
            : DEPOSIT_RAIL_ORDER.flatMap((corridor) => {
                  const rail = DEPOSIT_RAILS[corridor]
                  if ((method === 'pix') !== (corridor === 'PIX_BR')) return []
                  if (readyOnly && !selected.includes(rail.currency)) return []
                  const href = corridorTopUpHref(corridor, residenceIso2s)
                  return href ? [{ corridor, rail, href }] : []
              })

    const transferBadge = (gate: GateState, unavailable: boolean) => {
        if (unavailable) return <Badge status="neutral" customText={tAccounts('list.badgeNotOffered')} />
        switch (gate.kind) {
            case 'loading':
                return undefined
            case 'ready':
                return <Badge status="completed" customText={tAccounts('list.badgeReady')} />
            case 'needs-identity':
                return <Badge status="pending" customText={tAccounts('list.badgeVerifyId')} />
            case 'pending':
            case 'waiting-on-provider':
                return <Badge status="pending" customText={tAccounts('list.badgeUnderReview')} />
            case 'needs-enrollment':
            case 'accept-tos':
                return <Badge status="processing" customText={tAccounts('list.badgeSetUp')} />
            default:
                return <Badge status="pending" customText={tAccounts('list.badgeActionNeeded')} />
        }
    }
    const arUnavailable = !residenceAllows('BANK_TRANSFER_AR', residenceIso2s)
    return (
        <PageStack>
            <NavHeader
                title={title}
                onPrev={() => {
                    trackAddMoney(ANALYTICS_EVENTS.ADD_MONEY_BACK_TAPPED, {
                        country_list_source: countriesOpen
                            ? countrySearch.trim()
                                ? 'search'
                                : 'all_countries'
                            : 'none',
                    })
                    back()
                }}
            />
            <div className="flex flex-col gap-4" data-testid="add-money-options-list">
                {(readyOnly && readiness.isLoading) || (method === 'account' && deposit.isLoading) ? (
                    <Loading />
                ) : method === 'account' ? (
                    deposit.isError ? (
                        <Button onClick={deposit.refetch}>{tAccounts('list.errorRetry')}</Button>
                    ) : (
                        <ListGroup>
                            {heldRows.map((corridor) => {
                                const rail = DEPOSIT_RAILS[corridor]
                                const account = deposit.accounts[corridor]
                                const badge = readiness.ready.account.includes(rail.currency)
                                    ? transferBadge({ kind: 'ready' }, false)
                                    : account?.status === 'provisioning'
                                      ? transferBadge({ kind: 'pending' }, false)
                                      : account?.status === 'revoked' || account?.status === 'unavailable'
                                        ? transferBadge(deposit.gates[corridor], true)
                                        : undefined
                                return (
                                    <ListItem
                                        key={corridor}
                                        data-testid={`deposit-account-${corridor}`}
                                        title={rail.currency}
                                        leading={<CorridorFlag iso2={rail.flagIso2} />}
                                        trailing={badge}
                                        chevron
                                        onClick={() => openAccount(corridor)}
                                    />
                                )
                            })}
                            {open.map((row) => {
                                const rail = DEPOSIT_RAILS[row.corridor]
                                const gate = deposit.gates[row.corridor]
                                const badgeGate = gate.kind === 'ready' ? { kind: 'needs-enrollment' as const } : gate
                                return (
                                    <ListItem
                                        key={row.corridor}
                                        data-testid={`deposit-account-${row.corridor}`}
                                        title={rail.currency}
                                        leading={<CorridorFlag iso2={rail.flagIso2} />}
                                        trailing={transferBadge(badgeGate, !row.openable && !row.identityRefused)}
                                        chevron
                                        onClick={() => {
                                            if (row.openable) return openAccount(row.corridor)
                                            setAccountClosed(
                                                closedOpenRow(row, {
                                                    unavailable: deposit.unavailable[row.corridor],
                                                    gate,
                                                    hasResidence: residenceIso2s.length > 0,
                                                })
                                            )
                                        }}
                                    />
                                )
                            })}
                        </ListGroup>
                    )
                ) : (
                    <ListGroup>
                        {transferRows.map(({ corridor, rail, href }) => {
                            const residenceRestricted = !residenceAllows(corridor, residenceIso2s)
                            const paused = corridor === 'PIX_BR' && brazilPaused
                            return (
                                <ListItem
                                    key={corridor}
                                    data-testid={`add-money-option-${rail.currency}`}
                                    title={rail.currency}
                                    leading={<CorridorFlag iso2={rail.flagIso2} />}
                                    trailing={transferBadge(
                                        readiness.topUpGates[corridor],
                                        paused || residenceRestricted
                                    )}
                                    chevron
                                    onClick={() => {
                                        if (paused) return openBrazilPausedDrawer()
                                        if (
                                            residenceRestricted &&
                                            (corridor === 'PIX_BR' || corridor === 'BANK_TRANSFER_AR')
                                        ) {
                                            setRestricted(corridor)
                                            return
                                        }
                                        trackCurrency(corridor, href)
                                        router.push(withReturnTo(rewriteMethodPath(href), returnHere))
                                    }}
                                />
                            )
                        })}
                    </ListGroup>
                )}
                {method === 'transfer' && !readyOnly && (
                    <Accordion
                        type="single"
                        collapsible
                        variant="detached"
                        value={countriesOpen ? 'countries' : ''}
                        onValueChange={(value) => {
                            setCountriesOpen(!!value)
                            trackAddMoney(
                                value
                                    ? ANALYTICS_EVENTS.ADD_MONEY_COUNTRY_LIST_OPENED
                                    : ANALYTICS_EVENTS.ADD_MONEY_COUNTRY_LIST_CLOSED
                            )
                        }}
                    >
                        <Accordion.Item value="countries">
                            <Accordion.Trigger
                                leading={<IconBubble {...CONCEPT_ICONS.otherCountries} size="s" />}
                                title={tAccounts('list.countriesTitle')}
                                data-testid="other-countries-toggle"
                            />
                            <Accordion.Content flush>
                                <div className="flex flex-col gap-2">
                                    <SearchInput
                                        value={countrySearch}
                                        onChange={setCountrySearch}
                                        onClear={() => setCountrySearch('')}
                                        placeholder={tSearch('searchPlaceholder')}
                                        aria-label={tSearch('searchPlaceholder')}
                                    />
                                    <ListGroup>
                                        {TRANSFER_COUNTRIES.map(({ country, href }) => ({
                                            country,
                                            href,
                                            title: localizedCountryTitle(locale, country),
                                        }))
                                            .filter(({ country, title }) =>
                                                matchesCountryQuery(country, countrySearch.trim().toLowerCase(), title)
                                            )
                                            .sort(
                                                (a, b) =>
                                                    Number(arUnavailable && a.country.path === 'argentina') -
                                                        Number(arUnavailable && b.country.path === 'argentina') ||
                                                    a.title.localeCompare(b.title, locale)
                                            )
                                            .map(({ country, title, href }) => {
                                                const blocked = arUnavailable && country.path === 'argentina'
                                                return (
                                                    <ListItem
                                                        key={country.id}
                                                        title={title}
                                                        leading={
                                                            country.iso2 ? (
                                                                <CorridorFlag iso2={country.iso2.toLowerCase()} />
                                                            ) : undefined
                                                        }
                                                        trailing={
                                                            blocked
                                                                ? transferBadge({ kind: 'loading' }, true)
                                                                : undefined
                                                        }
                                                        chevron
                                                        onClick={() => {
                                                            if (blocked) return setRestricted('BANK_TRANSFER_AR')
                                                            trackAddMoney(ANALYTICS_EVENTS.ADD_MONEY_COUNTRY_SELECTED, {
                                                                country: country.path,
                                                                source: countrySearch.trim()
                                                                    ? 'search'
                                                                    : 'all_countries',
                                                                outcome: 'route',
                                                            })
                                                            trackAddMoney(ANALYTICS_EVENTS.DEPOSIT_METHOD_SELECTED, {
                                                                method_type: 'bank',
                                                                country: country.path,
                                                            })
                                                            router.push(
                                                                withReturnTo(rewriteMethodPath(href), returnHere)
                                                            )
                                                        }}
                                                    />
                                                )
                                            })}
                                    </ListGroup>
                                </div>
                            </Accordion.Content>
                        </Accordion.Item>
                    </Accordion>
                )}
                {accountClosed && method === 'account' && (
                    <ClosedRowDrawer
                        closed={accountClosed}
                        onClose={() => setAccountClosed(null)}
                        onChangeResidence={changeResidence}
                        onRetry={deposit.refetch}
                    />
                )}
                {restricted && !residenceAllows(restricted, residenceIso2s) && (
                    <ClosedRowDrawer
                        closed={{ kind: 'residence', corridor: restricted }}
                        onClose={() => setRestricted(null)}
                        onChangeResidence={changeResidence}
                        onPayQr={restricted === 'BANK_TRANSFER_AR' ? () => router.push('/qr-pay') : undefined}
                    />
                )}
            </div>
        </PageStack>
    )
}
