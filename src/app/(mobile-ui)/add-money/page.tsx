'use client'

import AddMoneyMethodSelection from '@/components/AddMoney/views/AddMoneyMethodSelection.view'
import { CountryList } from '@/components/Common/CountryList'
import type { CountryData } from '@/components/AddMoney/consts'
import NavHeader from '@/components/Global/NavHeader'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useQueryState, parseAsStringEnum } from 'nuqs'
import { checkIfInternalNavigation, getRedirectUrl, clearRedirectUrl, getFromLocalStorage } from '@/utils/general.utils'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

export default function AddMoneyPage() {
    const router = useRouter()
    const { resetOnrampFlow } = useOnrampFlow()
    const [method, setMethod] = useQueryState('method', parseAsStringEnum(['bank']))

    useEffect(() => {
        resetOnrampFlow()
    }, [])

    const handleBack = () => {
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

        const isInternalReferrer = checkIfInternalNavigation()

        if (isInternalReferrer && window.history.length > 1) {
            router.back()
        } else {
            router.push('/home')
        }
    }

    const handleCountryClick = (country: CountryData) => {
        posthog.capture(ANALYTICS_EVENTS.DEPOSIT_METHOD_SELECTED, {
            method_type: 'bank',
            country: country.path,
        })
        router.push(`/add-money/${country.path}`)
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
