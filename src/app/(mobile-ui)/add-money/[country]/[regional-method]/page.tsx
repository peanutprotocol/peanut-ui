'use client'
import MantecaAddMoney from '@/components/AddMoney/components/MantecaAddMoney'
import { MantecaTransfersMaintenanceView } from '@/components/Global/Banner/MantecaTransfersMaintenanceView'
import { type CountryData, countryData } from '@/components/AddMoney/consts'
import { isMantecaSupportedCountryCode } from '@/constants/manteca.consts'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import { useParams, useSearchParams } from 'next/navigation'

export default function AddMoneyRegionalMethodPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    // path params (web) or query params (native static export)
    const country = (params.country as string) || searchParams.get('country') || ''
    const method = (params['regional-method'] as string) || searchParams.get('view') || ''

    const countryDetails: CountryData | undefined = countryData.find((c) => c.path === country)

    if (isMantecaSupportedCountryCode(countryDetails?.id) && method === 'manteca') {
        // Manteca provider outage kill-switch — block the onramp with a clear message.
        if (underMaintenanceConfig.disableMantecaTransfers) {
            return <MantecaTransfersMaintenanceView action="deposits" />
        }
        return <MantecaAddMoney />
    }
    return null
}
