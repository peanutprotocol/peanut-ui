import { FC, useEffect, useMemo, useState } from 'react'
import MercadoPagoDepositDetails from './MercadoPagoDepositDetails'
import InputAmountStep from '../../InputAmountStep'
import { createMantecaOnramp } from '@/app/actions/onramp'
import { useParams, useRouter } from 'next/navigation'
import { countryData } from '@/components/AddMoney/consts'
import { MantecaDepositDetails } from '@/types/manteca.types'
import { InitiateMantecaKYCModal } from '@/components/Kyc/InitiateMantecaKYCModal'
import { useMantecaKycFlow } from '@/hooks/useMantecaKycFlow'

interface MercadoPagoProps {
    source: 'bank' | 'regionalMethod'
}

type stepType = 'inputAmount' | 'depositDetails'

const MercadoPago: FC<MercadoPagoProps> = ({ source }) => {
    const params = useParams()
    const router = useRouter()
    const [step, setStep] = useState<stepType>('inputAmount')
    const [isCreatingDeposit, setIsCreatingDeposit] = useState(false)
    const [tokenAmount, setTokenAmount] = useState('')
    const [tokenUSDAmount, setTokenUSDAmount] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [depositDetails, setDepositDetails] = useState<MantecaDepositDetails>()
    const [isKycModalOpen, setIsKycModalOpen] = useState(false)

    const selectedCountryPath = params.country as string
    const selectedCountry = useMemo(() => {
        return countryData.find((country) => country.type === 'country' && country.path === selectedCountryPath)
    }, [selectedCountryPath])
    const { isMantecaKycRequired } = useMantecaKycFlow()

    useEffect(() => {
        if (isMantecaKycRequired) {
            setIsKycModalOpen(true)
        }
    }, [isMantecaKycRequired])

    const handleKycCancel = () => {
        setIsKycModalOpen(false)
        if (selectedCountry?.path) {
            router.push(`/add-money/${selectedCountry.path}`)
        }
    }

    const handleAmountSubmit = async () => {
        if (!selectedCountry?.currency) return
        if (isCreatingDeposit) return

        try {
            setError(null)
            setIsCreatingDeposit(true)
            const depositData = await createMantecaOnramp({
                usdAmount: tokenUSDAmount.replace(/,/g, ''),
                currency: selectedCountry.currency,
            })
            if (depositData.error) {
                setError(depositData.error)
                return
            }
            setDepositDetails(depositData.data)
            setStep('depositDetails')
        } catch (error) {
            console.log(error)
            setError(error instanceof Error ? error.message : String(error))
        } finally {
            setIsCreatingDeposit(false)
        }
    }

    if (!selectedCountry) return null

    if (step === 'inputAmount') {
        return (
            <>
                <InputAmountStep
                    tokenAmount={tokenAmount}
                    setTokenAmount={setTokenAmount}
                    onSubmit={handleAmountSubmit}
                    selectedCountry={selectedCountry}
                    isLoading={isCreatingDeposit}
                    error={error}
                    setTokenUSDAmount={setTokenUSDAmount}
                />
                {isKycModalOpen && (
                    <InitiateMantecaKYCModal
                        isOpen={isKycModalOpen}
                        onClose={handleKycCancel}
                        onManualClose={handleKycCancel}
                        onKycSuccess={() => {
                            // close the modal and let the user continue with amount input
                            setIsKycModalOpen(false)
                        }}
                    />
                )}
            </>
        )
    }

    if (step === 'depositDetails' && depositDetails) {
        return <MercadoPagoDepositDetails source={source} depositDetails={depositDetails} />
    }

    return null
}

export default MercadoPago
