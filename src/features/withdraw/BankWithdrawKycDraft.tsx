'use client'

import { ADDITIONAL_VERIFICATION_ROUTE } from '@/constants/kyc.consts'
import { isSameRoute } from '@/constants/routes'
import type { OwnIbanDraft } from '@/components/AddWithdraw/DynamicBankAccountForm'
import { usePathname } from 'next/navigation'
import { parseAsString, useQueryStates } from 'nuqs'
import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'

type Draft = { userId: string; origin: string; values: OwnIbanDraft }
type DraftActions = {
    read: (origin: string) => OwnIbanDraft | undefined
    remember: (origin: string, values: OwnIbanDraft) => void
    clear: () => void
}

const DraftContext = createContext<DraftActions | null>(null)
// Web names the country in the path. Native uses the same /withdraw path for
// several rails and steps, so include the query fields that distinguish them.
const scopeParsers = {
    country: parseAsString,
    view: parseAsString,
    step: parseAsString,
    method: parseAsString,
    sendMethod: parseAsString,
}
type ScopeParams = Record<keyof typeof scopeParsers, string | null>
const routeKey = (path: string, { country, view, step, method, sendMethod }: ScopeParams) =>
    JSON.stringify([path.replace(/\/+$/, ''), country, view, step, method, sendMethod])
export function bankWithdrawRouteKey(path: string, query: Pick<URLSearchParams, 'get'>) {
    return routeKey(path, {
        country: query.get('country'),
        view: query.get('view'),
        step: query.get('step'),
        method: query.get('method'),
        sendMethod: query.get('sendMethod'),
    })
}

export function currentBankWithdrawRouteKey() {
    return bankWithdrawRouteKey(window.location.pathname, new URLSearchParams(window.location.search))
}

function DraftRouteBoundary({ onRoute }: { onRoute: () => void }) {
    const path = usePathname()
    const [query] = useQueryStates(scopeParsers)
    const key = routeKey(path, query)
    useEffect(onRoute, [onRoute, key])
    return null
}

/** One draft may outlive /withdraw while verification is open, within the signed-in app shell. */
export function BankWithdrawKycDraftProvider({ userId, children }: { userId?: string; children: ReactNode }) {
    const draft = useRef<Draft | null>(null)

    useEffect(() => {
        if (draft.current?.userId !== userId) draft.current = null
    }, [userId])

    const onRoute = useCallback(() => {
        const path = window.location.pathname
        if (isSameRoute(path, '/verify') || isSameRoute(path, ADDITIONAL_VERIFICATION_ROUTE)) return
        if (draft.current && draft.current.origin !== currentBankWithdrawRouteKey()) draft.current = null
    }, [])
    const actions = useMemo<DraftActions>(
        () => ({
            read: (origin) => {
                const saved = draft.current
                if (saved && saved.userId === userId && saved.origin === origin) return saved.values
                return undefined
            },
            remember: (origin, values) => {
                if (userId) draft.current = { userId, origin, values }
            },
            clear: () => {
                draft.current = null
            },
        }),
        [userId]
    )

    return (
        <DraftContext.Provider value={actions}>
            <Suspense fallback={null}>
                <DraftRouteBoundary onRoute={onRoute} />
            </Suspense>
            {children}
        </DraftContext.Provider>
    )
}

export const useBankWithdrawKycDraft = () => useContext(DraftContext)
