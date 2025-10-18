import React, { useEffect, useState, useMemo } from 'react'
import { type CountryData } from '@/components/AddMoney/consts'
import MantecaDepositShareDetails from '@/components/AddMoney/components/MantecaDepositShareDetails'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { MantecaGeoSpecificKycModal } from '@/components/Kyc/InitiateMantecaKYCModal'
import { useAuth } from '@/context/authContext'
import { useRequestFulfillmentFlow } from '@/context/RequestFulfillmentFlowContext'
import { usePaymentStore } from '@/redux/hooks'
import { mantecaApi } from '@/services/manteca'
import { useQuery } from '@tanstack/react-query'
import useKycStatus from '@/hooks/useKycStatus'
import ErrorAlert from '@/components/Global/ErrorAlert'

const MantecaFulfillment = () => {
    const { setFulfillUsingManteca, selectedCountry, setSelectedCountry } = useRequestFulfillmentFlow()
    const { requestDetails, chargeDetails } = usePaymentStore()
    const [isKYCModalOpen, setIsKYCModalOpen] = useState(false)
    const { isUserMantecaKycApproved, isUserBridgeKycApproved } = useKycStatus()
    const { fetchUser } = useAuth()

    const currency = selectedCountry?.currency || 'ARS'
    const {
        data: depositData,
        isLoading: isLoadingDeposit,
        isError,
        error,
    } = useQuery({
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

    const errorMessage = useMemo(() => {
        if (error) {
            return error.message
        }
        if (!chargeDetails) {
            return 'Charge details not found'
        }
    }, [error, chargeDetails])

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
            {depositData?.data && <MantecaDepositShareDetails source={'bank'} depositDetails={depositData.data} />}
            {errorMessage && <ErrorAlert description={errorMessage} />}

            {isKYCModalOpen && (
                <MantecaGeoSpecificKycModal
                    isUserBridgeKycApproved={isUserBridgeKycApproved}
                    isMantecaModalOpen={isKYCModalOpen}
                    setIsMantecaModalOpen={setIsKYCModalOpen}
                    onClose={handleKycCancel}
                    onManualClose={handleKycCancel}
                    onKycSuccess={() => {
                        // close the modal and let the user continue with amount input
                        setIsKYCModalOpen(false)
                        fetchUser()
                    }}
                    selectedCountry={selectedCountry || argentinaCountryData}
                />
            )}
        </div>
    )
}

export default MantecaFulfillment
