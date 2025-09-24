import React, { useEffect, useState } from 'react'
import { CountryData } from '@/components/AddMoney/consts'
import MantecaDepositShareDetails from '@/components/AddMoney/components/MantecaDepositShareDetails'
import PeanutLoading from '@/components/Global/PeanutLoading'
import NavHeader from '@/components/Global/NavHeader'
import { InitiateMantecaKYCModal } from '@/components/Kyc/InitiateMantecaKYCModal'
import { useAuth } from '@/context/authContext'
import { useRequestFulfillmentFlow } from '@/context/RequestFulfillmentFlowContext'
import useKycStatus from '@/hooks/useKycStatus'
import { usePaymentStore } from '@/redux/hooks'
import { mantecaApi } from '@/services/manteca'
import { useQuery } from '@tanstack/react-query'

const MantecaFulfillment = () => {
    const { setFulfillUsingManteca, selectedCountry, setSelectedCountry } = useRequestFulfillmentFlow()
    const { requestDetails, chargeDetails } = usePaymentStore()
    const [isKYCModalOpen, setIsKYCModalOpen] = useState(false)
    const { isUserMantecaKycApproved } = useKycStatus()
    const { fetchUser } = useAuth()

    const currency = selectedCountry?.currency || 'ARS'
    const { data: depositData, isLoading: isLoadingDeposit } = useQuery({
        queryKey: ['manteca-deposit', chargeDetails?.uuid, currency],
        queryFn: () =>
            mantecaApi.deposit({
                usdAmount: requestDetails?.tokenAmount || chargeDetails?.tokenAmount || '0',
                currency,
                chargeId: chargeDetails?.uuid,
            }),
        refetchOnWindowFocus: false,
        staleTime: Infinity, // don't refetch the data
        enabled: Boolean(chargeDetails?.uuid) && isUserMantecaKycApproved,
    })

    const argentinaCountryData = {
        id: 'AR',
        type: 'country',
        title: 'Argentina',
        currency: 'ARS',
        path: 'argentina',
        iso2: 'AR',
        iso3: 'ARG',
    } as CountryData

    const handleKycCancel = () => {
        setIsKYCModalOpen(false)
        setSelectedCountry(null)
        setFulfillUsingManteca(false)
    }

    useEffect(() => {
        if (!isUserMantecaKycApproved) {
            setIsKYCModalOpen(true)
        }
    }, [isUserMantecaKycApproved])

    if (isLoadingDeposit) {
        return <PeanutLoading coverFullScreen />
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8 md:min-h-fit">
            <NavHeader
                title="Send"
                onPrev={() => {
                    setSelectedCountry(null)
                    setFulfillUsingManteca(false)
                }}
            />

            {depositData?.data && <MantecaDepositShareDetails source={'bank'} depositDetails={depositData.data} />}

            {isKYCModalOpen && (
                <InitiateMantecaKYCModal
                    isOpen={isKYCModalOpen}
                    onClose={handleKycCancel}
                    onManualClose={handleKycCancel}
                    onKycSuccess={() => {
                        // close the modal and let the user continue with amount input
                        setIsKYCModalOpen(false)
                        fetchUser()
                    }}
                    country={selectedCountry || argentinaCountryData}
                />
            )}
        </div>
    )
}

export default MantecaFulfillment
