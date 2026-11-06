'use client'
import MantecaAddMoney from '@/components/AddMoney/components/MantecaAddMoney'
import { MantecaTransfersMaintenanceView } from '@/components/Global/Banner/MantecaTransfersMaintenanceView'
import { type CountryData, countryData } from '@/components/AddMoney/consts'
import { isMantecaSupportedCountryCode } from '@/constants/manteca.consts'
import RouteAlias from '@/components/Global/RouteAlias'
import { PIX_ADD_MONEY_PATH } from '@/features/pix/pix.routes'
import { useKillSwitches } from '@/features/kill-switches/useKillSwitches'
import { useParams, useSearchParams } from 'next/navigation'

export default function AddMoneyRegionalMethodPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const { disabledMantecaCurrencies } = useKillSwitches()
    // path params (web) or query params (native static export)
    const country = (params.country as string) || searchParams.get('country') || ''
    const method = (params['regional-method'] as string) || searchParams.get('view') || ''

    const countryDetails: CountryData | undefined = countryData.find((c) => c.path === country)

    if (isMantecaSupportedCountryCode(countryDetails?.id) && method === 'manteca') {
        const currency = countryDetails?.currency?.toUpperCase() ?? ''
        // Brazil's Pix mounts on the neutral page, where the backend's route picks the provider
        if (currency === 'BRL') return <RouteAlias to={PIX_ADD_MONEY_PATH} />
        // Manteca provider outage — block the onramp only for currencies still down.
        if ((disabledMantecaCurrencies as string[]).includes(currency)) {
            return <MantecaTransfersMaintenanceView action="deposits" />
        }
        return <MantecaAddMoney />
    }
    return null
}
