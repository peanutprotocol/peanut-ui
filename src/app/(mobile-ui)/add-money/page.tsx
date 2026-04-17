'use client'

import AddMoneyMethodSelection from '@/components/AddMoney/views/AddMoneyMethodSelection.view'
import AddWithdrawCountriesList from '@/components/AddWithdraw/AddWithdrawCountriesList'
import dynamic from 'next/dynamic'

// in native build, [country] dir is disabled — component is copied to _onramp-bank.tsx by build script.
// lazy loaded so web build doesn't fail when the file doesn't exist.
const OnrampBankPage = dynamic(() => import('./_onramp-bank'), { ssr: false })
import { CountryList } from '@/components/Common/CountryList'
import type { CountryData } from '@/components/AddMoney/consts'
import NavHeader from '@/components/Global/NavHeader'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { useQueryState, parseAsStringEnum } from 'nuqs'
import { checkIfInternalNavigation, getRedirectUrl, clearRedirectUrl, getFromLocalStorage } from '@/utils/general.utils'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { addMoneyCountryUrl } from '@/utils/native-routes'

export default function AddMoneyPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { resetOnrampFlow } = useOnrampFlow()
    const [method, setMethod] = useQueryState('method', parseAsStringEnum(['bank']))

    // native app passes country as query param instead of path segment
    const countryFromQuery = searchParams.get('country')

    useEffect(() => {
        if (!countryFromQuery) resetOnrampFlow()
    }, [])

    const handleBack = () => {
        // if viewing country-specific form, go back to country list
        if (countryFromQuery) {
            router.push('/add-money?method=bank')
            return
        }

        // if on country list view, go back to method selection
        if (method === 'bank') {
            setMethod(null)
            return
        }

        // check if we have a saved redirect url (from request fulfillment or similar flows)
        const redirectUrl = getRedirectUrl()
        const fromRequestFulfillment = getFromLocalStorage('fromRequestFulfillment')

        if (redirectUrl && fromRequestFulfillment) {
            clearRedirectUrl()
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('fromRequestFulfillment')
            }
            router.push(redirectUrl)
            return
        }

        // always navigate to /home from root add-money page — router.back() causes
        // loops because sub-pages (crypto, country) are in the history stack
        router.push('/home')
    }

    const handleCountryClick = (country: CountryData) => {
        posthog.capture(ANALYTICS_EVENTS.DEPOSIT_METHOD_SELECTED, {
            method_type: 'bank',
            country: country.path,
        })
        router.push(addMoneyCountryUrl(country.path))
    }

    // native app: render sub-views based on query params
    const viewFromQuery = searchParams.get('view')
    if (countryFromQuery && viewFromQuery === 'bank') {
        // bank form: /add-money?country=austria&view=bank
        return <OnrampBankPage />
    }
    if (countryFromQuery) {
        // country method selection: /add-money?country=austria
        return <AddWithdrawCountriesList flow="add" />
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-8">
            <NavHeader title="Add Money" onPrev={handleBack} />

            {method === 'bank' ? (
                <CountryList
                    inputTitle="Select your country"
                    viewMode="add-withdraw"
                    flow="add"
                    onCountryClick={handleCountryClick}
                />
            ) : (
                <AddMoneyMethodSelection onBankTransferClick={() => setMethod('bank')} />
            )}
        </div>
    )
}
