'use client'

import { useAddMoneyFlow } from '@/features/add-money/useAddMoneyFlow'
import { DepositAccountsFlowContainer } from '@/features/deposit-accounts/components/DepositAccountsFlowContainer'
import dynamic from 'next/dynamic'

// stubs exist for web build; real components are injected by native build script.
// these dynamic imports must stay route-local: scripts/native-build.js copies the
// real pages over the sibling _onramp-* stub files.
const OnrampBankPage = dynamic(() => import('./_onramp-bank'), { ssr: false })
const OnrampMantecaPage = dynamic(() => import('./_onramp-manteca'), { ssr: false })
const AddWithdrawCountriesList = dynamic(() => import('@/components/AddWithdraw/AddWithdrawCountriesList'), {
    ssr: false,
})

export default function AddMoneyPage() {
    const { countryFromQuery, viewFromQuery, isBareRoot, handleBack } = useAddMoneyFlow()

    // native app: render sub-views based on query params
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

    // redirecting — render nothing for the one frame before replace() lands
    if (isBareRoot) return null

    // ?method=bank: the accounts this user holds, crypto, and every country
    // they can send money in from
    return <DepositAccountsFlowContainer onExit={handleBack} />
}
