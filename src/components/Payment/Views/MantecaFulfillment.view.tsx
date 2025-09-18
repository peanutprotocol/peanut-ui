import React, { useEffect, useState } from 'react'
import { MERCADO_PAGO, PIX } from '@/assets'
import { CountryData } from '@/components/AddMoney/consts'
import ErrorAlert from '@/components/Global/ErrorAlert'
import MantecaDetailsCard from '@/components/Global/MantecaDetailsCard'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import PeanutLoading from '@/components/Global/PeanutLoading'
import ShareButton from '@/components/Global/ShareButton'
import { InitiateMantecaKYCModal } from '@/components/Kyc/InitiateMantecaKYCModal'
import { useAuth } from '@/context/authContext'
import { useRequestFulfillmentFlow } from '@/context/RequestFulfillmentFlowContext'
import useKycStatus from '@/hooks/useKycStatus'
import { usePaymentStore } from '@/redux/hooks'
import { mantecaApi } from '@/services/manteca'
import { useQuery } from '@tanstack/react-query'

const MantecaFulfillment = () => {
    const { setFulfillUsingManteca, selectedCountry, setSelectedCountry, regionalMethodType } =
        useRequestFulfillmentFlow()
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

    const actionCardLogo = selectedCountry?.id
        ? `https://flagcdn.com/w320/${selectedCountry?.id.toLowerCase()}.png`
        : regionalMethodType === 'mercadopago'
          ? MERCADO_PAGO
          : PIX

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

    const generateShareText = () => {
        const textParts = []
        textParts.push(`CBU: ${depositData?.data?.depositAddress}`)
        textParts.push(`Alias: ${depositData?.data?.depositAlias}`)

        return textParts.join('\n')
    }

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

            <div className="my-auto space-y-4">
                <PeanutActionDetailsCard
                    avatarSize="medium"
                    transactionType="REQUEST_PAYMENT"
                    recipientType="USERNAME"
                    recipientName={requestDetails?.recipientAccount.user.username ?? ''}
                    amount={requestDetails?.tokenAmount || chargeDetails?.tokenAmount || '0'}
                    tokenSymbol={requestDetails?.tokenSymbol || 'USDC'}
                    message={requestDetails?.reference || chargeDetails?.requestLink?.reference || ''}
                    fileUrl={requestDetails?.attachmentUrl || chargeDetails?.requestLink?.attachmentUrl || ''}
                    logo={actionCardLogo}
                    countryCodeForFlag={selectedCountry?.id.toLowerCase()}
                />

                {depositData?.error && <ErrorAlert description={depositData.error} />}

                {depositData?.data && (
                    <>
                        <p className="font-bold">Account details</p>

                        <MantecaDetailsCard
                            rows={[
                                ...(depositData?.data?.depositAddress
                                    ? [
                                          {
                                              key: 'cbu',
                                              label: 'CBU',
                                              value: depositData.data.depositAddress,
                                              allowCopy: true,
                                          },
                                      ]
                                    : []),
                                ...(depositData?.data?.depositAlias
                                    ? [
                                          {
                                              key: 'alias',
                                              label: 'Alias',
                                              value: depositData.data.depositAlias,
                                              hideBottomBorder: true,
                                          },
                                      ]
                                    : []),
                            ]}
                        />

                        <ShareButton
                            generateText={async () => generateShareText()}
                            title="Account Details"
                            variant="purple"
                            className="w-full"
                        >
                            Share Details
                        </ShareButton>
                    </>
                )}
            </div>
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
