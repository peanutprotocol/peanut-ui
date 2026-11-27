'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { countryData } from '@/components/AddMoney/consts'
import Badge from '@/components/Global/Badges/Badge'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { ClosedRowDrawer } from '@/features/deposit-accounts/components/ClosedRowDrawer'
import { CorridorFlag } from '@/features/deposit-accounts/components/CorridorFlag'
import { closedOpenRow, virtualAccountRows, type ClosedRow } from '@/features/deposit-accounts/hubRows'
import { DEPOSIT_RAIL_ORDER, DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import { isHeld } from '@/features/deposit-accounts/resolveScreen'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useReturnTo } from '@/hooks/useSafeBack'
import type { GateState } from '@/utils/capability-gate'
import { readReturnTo, withReturnTo } from '@/utils/return-to.utils'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs'
import { useEffect, useRef, useState } from 'react'
import { trackAddMoney } from './analytics'
import { corridorTopUpHref } from './countryRoutes'
import { useAddMoneyReadiness } from './useAddMoneyReadiness'

// The bank accounts a user holds or can open. The one-time transfer has no chooser of its own (the owner,
// 25 Nov): the picker's one bank row opens the bank hub, so a stale `?method=transfer` link returns to the picker.
const FIAT_METHODS = ['account'] as const

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
    // the picker always sends a returnTo; only the Home Add drawer sends none (TASK-25079)
    const back = useReturnTo(origin ?? '/home')
    const readiness = useAddMoneyReadiness(false, method === 'account' || readyOnly)
    const deposit = useDepositAccounts({ enabled: method === 'account' })
    const { isTerminalFailure } = useIdentityVerification()
    const { residenceIso2s, standingEnabled } = readiness
    const viewed = useRef(false)
    const [accountClosed, setAccountClosed] = useState<ClosedRow | null>(null)

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
    const title = readyOnly ? tProfile('titles.bank') : t('openAccount')
    const { held, open } = virtualAccountRows(deposit, standingEnabled && !readyOnly, isTerminalFailure)
    const heldRows = readyOnly ? held.filter((corridor) => selected.includes(DEPOSIT_RAILS[corridor].currency)) : held
    const openAccount = (corridor: DepositCorridor) => {
        trackCurrency(corridor, corridorTopUpHref(corridor, residenceIso2s))
        const step = isHeld(deposit.accounts[corridor]) ? 'details' : 'claim'
        router.push(withReturnTo(`/add-money?method=bank&corridor=${corridor}&step=${step}`, returnHere))
    }
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
    return (
        <PageStack>
            <NavHeader
                title={title}
                onPrev={() => {
                    trackAddMoney(ANALYTICS_EVENTS.ADD_MONEY_BACK_TAPPED, { country_list_source: 'none' })
                    back()
                }}
            />
            <div className="flex flex-col gap-4" data-testid="add-money-options-list">
                {(readyOnly && readiness.isLoading) || deposit.isLoading ? (
                    <Loading />
                ) : deposit.isError ? (
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
                )}
                {accountClosed && (
                    <ClosedRowDrawer
                        closed={accountClosed}
                        onClose={() => setAccountClosed(null)}
                        onChangeResidence={changeResidence}
                        onRetry={deposit.refetch}
                    />
                )}
            </div>
        </PageStack>
    )
}
