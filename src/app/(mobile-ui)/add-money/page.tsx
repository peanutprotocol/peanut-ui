'use client'

import AddWithdrawCountriesList from '@/components/AddWithdraw/AddWithdrawCountriesList'
import dynamic from 'next/dynamic'

// stubs exist for web build; real components are injected by native build script.
const OnrampBankPage = dynamic(() => import('./_onramp-bank'), { ssr: false })
const OnrampMantecaPage = dynamic(() => import('./_onramp-manteca'), { ssr: false })
import { CountryList } from '@/components/Common/CountryList'
import type { CountryData } from '@/components/AddMoney/consts'
import { ActionListCard } from '@/components/ActionListCard'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import ChooseNetworkDrawer from '@/components/AddMoney/components/ChooseNetworkDrawer'
// offramp.xyz migrants get this link-granted badge at signup (peanut-api-ts
// invite/badge routes, code `offramp` / utm `offramp`).
import { OFFRAMP_BADGE_CODE } from '@/components/Invites/campaign-maps'
import type { RhinoChainType } from '@/services/services.types'
import NavHeader from '@/components/Global/NavHeader'
import { useAuth } from '@/context/authContext'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getRedirectUrl, clearRedirectUrl, getFromLocalStorage } from '@/utils/general.utils'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { addMoneyCountryUrl } from '@/utils/native-routes'

export default function AddMoneyPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { resetOnrampFlow } = useOnrampFlow()
    const { user } = useAuth()
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

    // native app passes country as query param instead of path segment
    const countryFromQuery = searchParams.get('country')

    // offramp migrants get a tailored arbitrum deposit entry above the country list
    const hasOfframpBadge = user?.user?.badges?.some((b) => b.code === OFFRAMP_BADGE_CODE) ?? false

    // clear stale onramp state whenever we land on the root country list (no
    // country in the URL) — reruns on back-nav from a ?country=… sub-view, not
    // just on mount. resetOnrampFlow is a stable useCallback.
    useEffect(() => {
        if (!countryFromQuery) resetOnrampFlow()
    }, [countryFromQuery, resetOnrampFlow])

    const handleBack = () => {
        // note: this only runs from the root list's NavHeader — the ?country=…
        // sub-views early-return their own NavHeader below, so countryFromQuery
        // is always absent here.

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

    const handleNetworkSelect = (network: RhinoChainType) => {
        setIsDrawerOpen(false)
        // mirror the bank event in handleCountryClick so crypto deposits from the
        // root aren't undercounted in the deposit-method funnel.
        posthog.capture(ANALYTICS_EVENTS.DEPOSIT_METHOD_SELECTED, {
            method_type: 'crypto',
            country: 'crypto',
        })
        router.push(`/add-money/crypto?network=${network}`)
    }

    // native app: render sub-views based on query params
    const viewFromQuery = searchParams.get('view')
    if (countryFromQuery && viewFromQuery === 'bank') {
        return <OnrampBankPage />
    }
    if (countryFromQuery && viewFromQuery === 'manteca') {
        return <OnrampMantecaPage />
    }
    if (countryFromQuery) {
        // country method selection: /add-money?country=austria
        return <AddWithdrawCountriesList flow="add" />
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-8">
            <NavHeader title="Add Money" onPrev={handleBack} />

            {hasOfframpBadge && (
                <ActionListCard
                    title="Migrate from Offramp"
                    description="Move your Offramp balance to Peanut"
                    position="single"
                    leftIcon={<AvatarWithBadge icon="wallet-outline" size="extra-small" className="bg-yellow-1" />}
                    onClick={() => router.push('/add-money/crypto?network=EVM&source=offramp')}
                />
            )}

            <CountryList
                inputTitle="Select your country"
                viewMode="add-withdraw"
                flow="add"
                onCountryClick={handleCountryClick}
                onCryptoClick={() => setIsDrawerOpen(true)}
            />

            <ChooseNetworkDrawer
                open={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                onSelect={handleNetworkSelect}
            />
        </div>
    )
}
