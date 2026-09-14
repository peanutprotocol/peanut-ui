'use client'

import React from 'react'
import { useSearchParams } from 'next/navigation'
import WithdrawRoot from '@/features/withdraw/WithdrawRoot'

// Module scope on purpose. React.lazy() mints a fresh, unresolved lazy on every
// call, so creating these inside the render body made the subtree suspend again
// on EVERY re-render: React hid the rendered view and swapped in the Suspense
// fallback (null) until the import re-resolved a microtask later. On the native
// ?country=…&view=bank route that showed up as the withdraw screen blanking and
// loading a second time. Hoisted, the lazy resolves once and later renders pass
// straight through.
const WithdrawBankPage = React.lazy(() => import('./_withdraw-bank'))
const AddWithdrawCountriesList = React.lazy(() => import('@/components/AddWithdraw/AddWithdrawCountriesList'))

export default function WithdrawPage() {
    const searchParams = useSearchParams()

    // native app passes country as a query param instead of a path segment
    const countryFromQuery = searchParams.get('country')
    const viewFromQuery = searchParams.get('view')

    if (countryFromQuery) {
        // native app: render country-specific views.
        // stub exists for web build; real component is injected by native build script.
        if (viewFromQuery === 'bank') {
            return (
                <React.Suspense fallback={null}>
                    <WithdrawBankPage />
                </React.Suspense>
            )
        }
        return (
            <React.Suspense fallback={null}>
                <AddWithdrawCountriesList flow="withdraw" />
            </React.Suspense>
        )
    }

    return <WithdrawRoot />
}
