import { MERCADO_PAGO } from '@/assets'
import ErrorAlert from '@/components/Global/ErrorAlert'
import MantecaDetailsCard from '@/components/Global/MantecaDetailsCard'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import PeanutLoading from '@/components/Global/PeanutLoading'
import ShareButton from '@/components/Global/ShareButton'
import { useRequestFulfillmentFlow } from '@/context/RequestFulfillmentFlowContext'
import { usePaymentStore } from '@/redux/hooks'
import { mantecaApi } from '@/services/manteca'
import { useQuery } from '@tanstack/react-query'
import React from 'react'

const MantecaFulfuillment = () => {
    const { setFulfillUsingManteca } = useRequestFulfillmentFlow()
    const { requestDetails, chargeDetails } = usePaymentStore()
    const { data: depositData, isLoading: isLoadingDeposit } = useQuery({
        queryKey: ['manteca-deposit', chargeDetails?.uuid],
        queryFn: () =>
            mantecaApi.deposit({
                usdAmount: requestDetails?.tokenAmount || chargeDetails?.tokenAmount || '0',
                currency: 'ARS',
                chargeId: chargeDetails?.uuid,
            }),
        refetchOnWindowFocus: false,
        staleTime: Infinity, // don't refetch the data
        enabled: Boolean(chargeDetails?.uuid),
    })

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
                    logo={MERCADO_PAGO}
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
        </div>
    )
}

export default MantecaFulfuillment
