'use client'

import AddWithdrawCountriesList from '@/components/AddWithdraw/AddWithdrawCountriesList'
import { useAddMoneyFlow } from '@/features/add-money/useAddMoneyFlow'
import { AddMoneyBankCountryListView } from '@/features/add-money/views/AddMoneyBankCountryListView'
import { AddMoneyCountryRoutesView } from '@/features/add-money/views/AddMoneyCountryRoutesView'
import { DepositAccountsFlowContainer } from '@/features/deposit-accounts/components/DepositAccountsFlowContainer'
import dynamic from 'next/dynamic'

// stubs exist for web build; real components are injected by native build script.
// these dynamic imports must stay route-local: scripts/native-build.js copies the
// real pages over the sibling _onramp-* stub files.
const OnrampBankPage = dynamic(() => import('./_onramp-bank'), { ssr: false })
const OnrampMantecaPage = dynamic(() => import('./_onramp-manteca'), { ssr: false })

export default function AddMoneyPage() {
    const {
        countryFromQuery,
        viewFromQuery,
        isBareRoot,
        showsDepositAccounts,
        handleBack,
        handleCountryClick,
        handleDepositAccountsExit,
        routesCountry,
        countryRoutes,
        openRoute,
        handleRoutesBack,
        isCountrySupported,
    } = useAddMoneyFlow()

    // a country that resolved to a standing account opens the get-paid screens
    // here, rather than sending the user to a second flow to read the same
    // details — they are the same components either way
    if (showsDepositAccounts) {
        return <DepositAccountsFlowContainer onExit={handleDepositAccountsExit} />
    }

    // a country with more than one bank route asks which one before it opens
    if (routesCountry) {
        return (
            <AddMoneyCountryRoutesView
                country={routesCountry}
                routes={countryRoutes}
                onBack={handleRoutesBack}
                onSelect={openRoute}
            />
        )
    }

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
    return (
        <AddMoneyBankCountryListView
            onBack={handleBack}
            onCountryClick={handleCountryClick}
            isCountrySupported={isCountrySupported}
        />
    )
}
