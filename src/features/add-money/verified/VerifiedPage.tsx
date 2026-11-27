'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { NameChip } from '@/components/Setup/redesign/shell/NameChip'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'
import { SetupShell } from '@/components/Setup/redesign/shell/SetupShell'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useAuth } from '@/context/authContext'
import { DEPOSIT_RAIL_ORDER, DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { useDepositGateRemediation } from '@/features/deposit-accounts/useDepositGateRemediation'
import { accountEntry, entryAction } from '@/features/kyc-features/report'
import { restoreNativeStatusBar } from '@/features/paperwork-verification/useInsetColor'
import { currentVerifySource } from '@/features/paperwork-verification/verifySource'
import { findPixRoute, pixDepositOffered } from '@/features/pix/pixRoute.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { markSubmitted } from '@/hooks/useSubmissionWindow'
import { trackAddMoney } from '../analytics'
import { addMoneyMethodHref, isAddMoneyRowMethod, useAddMoneyMethodRows } from '../useAddMoneyMethodRows'
import { useAddMoneyReadiness } from '../useAddMoneyReadiness'
import { markBankReadyShown, readyAccountIds } from './bankReadyReminder'
import { VerifiedArt } from './VerifiedArt'
import {
    actionStep,
    anyBankReady,
    type BankRowState,
    cryptoWorksNow,
    VERIFIED_PAGE_PATH,
    VERIFIED_ROWS_SETTLE_MS,
    type VerifiedPageVariant,
    verifiedRow,
} from './verifiedRows'

type BankMethod = 'ars' | 'pix' | 'bank'

/**
 * "Your ID is verified" (add-money proposal, rules 1-3): opens at once on a self-started approval, no modal. The
 * pink stage of the sign-up Celebration, then the live Add list. Bank rows load in place while the accounts open,
 * then say where they stand in Aleks's words; crypto always works. `bank-ready` is the same page, re-shown once a
 * bank account opens (slice 5).
 */
export function VerifiedPage({ variant }: { variant: VerifiedPageVariant }) {
    // the shell paints the native status bar pink; a layout cleanup runs before the next screen paints its own
    useLayoutEffect(() => restoreNativeStatusBar, [])
    const t = useTranslations('addMoney.verified')
    const tCommon = useTranslations('common')
    const locale = useLocale()
    const router = useRouter()
    const { user } = useAuth()
    const { capabilities } = useCapabilities()
    const readiness = useAddMoneyReadiness(true)
    const methodRows = useAddMoneyMethodRows()
    const remediation = useDepositGateRemediation()

    // the accounts open just after approval: rows load in place, polled by the submission window, then settle
    const [settled, setSettled] = useState(false)
    const openedAt = useRef(Date.now())
    const entry = useRef(currentVerifySource() ?? 'direct')
    useEffect(() => {
        markSubmitted()
        const timer = setTimeout(() => setSettled(true), VERIFIED_ROWS_SETTLE_MS)
        return () => clearTimeout(timer)
    }, [])

    const report = capabilities.features
    const userId = user?.user.userId
    // an account seen ready here, or from the bank_ready push, never opens the reminder again
    useEffect(() => {
        if (userId) markBankReadyShown(userId, readyAccountIds(report))
    }, [userId, report])
    const pixRoute = findPixRoute(capabilities.routes, 'deposit')
    const bank: Record<BankMethod, ReturnType<typeof verifiedRow>> = {
        ars: verifiedRow(report && accountEntry(report, 'local', 'ARS'), capabilities, settled),
        // the Avenia route is offered before any account exists: Pix works from its row
        pix: pixDepositOffered(pixRoute)
            ? { gate: { kind: 'ready' }, state: 'ready' }
            : verifiedRow(report && accountEntry(report, 'local', 'BRL'), capabilities, settled),
        bank: verifiedRow(report?.bank, capabilities, settled),
    }
    const provider: Record<BankMethod, string> = {
        ars: 'Manteca',
        pix: pixRoute?.provider === 'avenia' ? 'Avenia' : 'Manteca',
        bank: 'Bridge',
    }
    const methods = readiness.pickerMethods.filter(isAddMoneyRowMethod)
    const shownBank = methods.filter((method): method is BankMethod => method !== 'crypto')
    const states = shownBank.map((method) => bank[method].state)
    const stateProps = Object.fromEntries(shownBank.map((method) => [method, bank[method].state]))
    const resolved = !readiness.isLoading && !states.includes('loading')

    const shown = useRef(false)
    useEffect(() => {
        if (shown.current || readiness.isLoading) return
        shown.current = true
        trackAddMoney(ANALYTICS_EVENTS.VERIFIED_PAGE_SHOWN, { entry: entry.current, variant, ...stateProps })
        // once per view, with the rows as they first read
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [readiness.isLoading])
    const reportedResolve = useRef(false)
    useEffect(() => {
        if (!resolved || reportedResolve.current) return
        reportedResolve.current = true
        trackAddMoney(ANALYTICS_EVENTS.VERIFIED_PAGE_ROWS_RESOLVED, {
            entry: entry.current,
            variant,
            wait_ms: Date.now() - openedAt.current,
            ...stateProps,
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolved])

    // the step opens for its account: on the bank row, the Bridge account that asks for it
    const corridorOf = (method: BankMethod): DepositCorridor =>
        method === 'ars'
            ? 'BANK_TRANSFER_AR'
            : method === 'pix'
              ? 'PIX_BR'
              : (DEPOSIT_RAIL_ORDER.find((corridor) => {
                    const rail = DEPOSIT_RAILS[corridor]
                    return (
                        rail.provider === 'bridge' && report?.bank.accounts[rail.currency]?.state === 'action_required'
                    )
                }) ?? 'ACH_US')
    const termsCurrencies = Object.entries(report?.bank.accounts ?? {})
        .filter(([, account]) => entryAction(account, capabilities.nextActions)?.kind === 'accept-tos')
        .map(([currency]) => currency)

    const actionWhat = (method: BankMethod): string | null => {
        const step = actionStep(bank[method].gate)
        if (step === 'address') return t('actionAddress')
        if (step !== 'terms') return null
        return termsCurrencies.length
            ? t('actionTerms', {
                  provider: provider[method],
                  currencies: new Intl.ListFormat(locale, { type: 'conjunction' }).format(termsCurrencies),
              })
            : t('actionTermsGeneric', { provider: provider[method] })
    }

    const bodyOf = (method: BankMethod, state: BankRowState) => {
        switch (state) {
            case 'loading':
                return <div className="mt-1 h-4 w-36 animate-pulse rounded bg-background-skeleton" />
            case 'review':
                return t('underReview', { provider: provider[method] })
            case 'refused':
                return t('notApproved', { provider: provider[method] })
            case 'action': {
                const what = actionWhat(method)
                return (
                    <span>
                        <span className="underline">{t('actionNeeded')}</span>
                        {what && ` · ${what}`}
                    </span>
                )
            }
            default:
                return methodRows[method].description
        }
    }

    const tap = (method: BankMethod | 'crypto', state: BankRowState | 'ready') => {
        trackAddMoney(ANALYTICS_EVENTS.VERIFIED_PAGE_METHOD_TAPPED, { method, state, entry: entry.current, variant })
        if (method !== 'crypto' && state === 'action') {
            remediation.resolveGate(bank[method].gate, corridorOf(method))
            return
        }
        router.push(addMoneyMethodHref(method, VERIFIED_PAGE_PATH, VERIFIED_PAGE_PATH))
    }

    const username = user?.user.username

    return (
        <>
            <SetupShell screenId="success">
                <SetupScreen
                    ground="pink"
                    stage="std"
                    chrome={{ back: false, dots: false, lang: false }}
                    art={<VerifiedArt />}
                    footer={null}
                    state={`verified-${variant}`}
                    testId="verified-page"
                    stageCopy={
                        <div className="absolute inset-x-[var(--sr-gutter)] bottom-[calc(100%-var(--sr-stage-std)+1.5rem)] signup-sm:bottom-[calc(100%-var(--sr-stage-std)+1rem)]">
                            <h1 className="text-heading-m text-balance signup-sm:text-heading-s">
                                {t(variant === 'bank-ready' ? 'titleBankReady' : 'title')}
                            </h1>
                            {username && (
                                <NameChip username={username} verified={anyBankReady(states)} className="mt-3" />
                            )}
                            <p className="mt-3 text-body-m text-foreground-primary signup-sm:mt-2 signup-sm:text-body-s">
                                {t('sub')}
                            </p>
                        </div>
                    }
                >
                    <ListGroup>
                        {methods.map((method) => {
                            if (method === 'crypto')
                                return (
                                    <ListItem
                                        key={method}
                                        title={methodRows.crypto.title}
                                        body={
                                            cryptoWorksNow(states) ? t('cryptoWorksNow') : methodRows.crypto.description
                                        }
                                        bodyWrap
                                        leading={methodRows.crypto.icon}
                                        chevron
                                        data-testid="verified-method-crypto"
                                        onClick={() => tap('crypto', 'ready')}
                                    />
                                )
                            const { state } = bank[method]
                            // a provider decides: the row can't be tapped and never promises a time
                            const waiting = state === 'review' || state === 'refused'
                            const tappable = state !== 'loading' && !waiting
                            return (
                                <ListItem
                                    key={method}
                                    title={methodRows[method].title}
                                    body={bodyOf(method, state)}
                                    bodyWrap
                                    leading={methodRows[method].icon}
                                    chevron={tappable}
                                    disabled={waiting}
                                    onClick={tappable ? () => tap(method, state) : undefined}
                                    data-testid={`verified-method-${method}`}
                                    aria-label={state === 'loading' ? methodRows[method].title : undefined}
                                />
                            )
                        })}
                    </ListGroup>
                    <div className="mt-6 flex justify-center pb-6">
                        <LinkButton
                            onClick={() => {
                                trackAddMoney(ANALYTICS_EVENTS.VERIFIED_PAGE_LATER, {
                                    entry: entry.current,
                                    variant,
                                    ...stateProps,
                                })
                                router.replace('/home')
                            }}
                            data-testid="verified-later"
                        >
                            {tCommon('maybeLater')}
                        </LinkButton>
                    </div>
                </SetupScreen>
            </SetupShell>
            {remediation.modals}
        </>
    )
}
