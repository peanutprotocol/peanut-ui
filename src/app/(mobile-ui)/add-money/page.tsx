'use client'

import AddWithdrawCountriesList from '@/components/AddWithdraw/AddWithdrawCountriesList'
import { useAddMoneyFlow } from '@/features/add-money/useAddMoneyFlow'
import { AddMoneyBankCountryListView } from '@/features/add-money/views/AddMoneyBankCountryListView'
import dynamic from 'next/dynamic'

// stubs exist for web build; real components are injected by native build script.
// these dynamic imports must stay route-local: scripts/native-build.js copies the
// real pages over the sibling _onramp-* stub files.
const OnrampBankPage = dynamic(() => import('./_onramp-bank'), { ssr: false })
const OnrampMantecaPage = dynamic(() => import('./_onramp-manteca'), { ssr: false })

export default function AddMoneyPage() {
    const { countryFromQuery, viewFromQuery, isBareRoot, handleBack, handleCountryClick } = useAddMoneyFlow()

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

    // ?method=bank: the bank country list (board Page/Add/Bank 17830:77534)
    return <AddMoneyBankCountryListView onBack={handleBack} onCountryClick={handleCountryClick} />
}
