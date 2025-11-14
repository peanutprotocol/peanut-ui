import { useEffect, useState, useMemo } from 'react'
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
import { saveDevConnectIntent } from '@/utils'

const MantecaFulfillment = () => {
    const { setFulfillUsingManteca, selectedCountry, setSelectedCountry } = useRequestFulfillmentFlow()
    const { requestDetails, chargeDetails, parsedPaymentData, usdAmount } = usePaymentStore()
    const [isKYCModalOpen, setIsKYCModalOpen] = useState(false)
    const { isUserMantecaKycApproved, isUserBridgeKycApproved } = useKycStatus()
    const { fetchUser, user } = useAuth()

    // @dev: check if this is a devconnect flow (address@chain format) - to be deleted post devconnect
    const isDevConnectFlow = parsedPaymentData?.isDevConnectFlow || false

    // @dev: for devconnect flows, we create a deposit without chargeId and save the intent - to be deleted post devconnect
    const shouldCreateDeposit = isDevConnectFlow
        ? isUserMantecaKycApproved && !!usdAmount
        : Boolean(chargeDetails?.uuid) && isUserMantecaKycApproved

    const currency = selectedCountry?.currency || 'ARS'
    const {
        data: depositData,
        isLoading: isLoadingDeposit,
        isError,
        error,
    } = useQuery({
        queryKey: ['manteca-deposit', chargeDetails?.uuid, currency, isDevConnectFlow ? usdAmount : null],
        queryFn: async () => {
            const depositAmount = isDevConnectFlow
                ? usdAmount || '0'
                : requestDetails?.tokenAmount || chargeDetails?.tokenAmount || '0'

            const result = await mantecaApi.deposit({
                usdAmount: depositAmount,
                currency,
                chargeId: isDevConnectFlow ? undefined : chargeDetails?.uuid,
            })

            // @dev: save devconnect intent if this is a devconnect flow - to be deleted post devconnect
            if (isDevConnectFlow && result.data?.externalId) {
                saveDevConnectIntent(user?.user?.userId, parsedPaymentData, depositAmount, result.data.externalId)
            }

            return result
        },
        refetchOnWindowFocus: false,
        staleTime: Infinity, // don't refetch the data
        enabled: shouldCreateDeposit,
    })

    const errorMessage = useMemo(() => {
        if (error) {
            return error.message
        }
        // @dev: only check for charge details in non-devconnect flows - to be deleted post devconnect
        if (!isDevConnectFlow && !chargeDetails) {
            return 'Charge details not found'
        }
        // @dev: for devconnect flows, check if amount is provided - to be deleted post devconnect
        if (isDevConnectFlow && !usdAmount) {
            return 'Payment amount not found'
        }
    }, [error, chargeDetails, isDevConnectFlow, usdAmount])

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

    const handleBackClick = () => {
        // reset manteca fulfillment state to show payment options again
        setFulfillUsingManteca(false)
        setSelectedCountry(null)
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
            {depositData?.data && (
                <MantecaDepositShareDetails
                    source={'bank'}
                    depositDetails={depositData.data}
                    onBack={handleBackClick}
                />
            )}
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
