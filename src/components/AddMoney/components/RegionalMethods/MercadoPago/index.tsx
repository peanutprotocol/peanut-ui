import React, { FC, useMemo, useState } from 'react'
import MercadoPagoDepositDetails from './MercadoPagoDepositDetails'
import InputAmountStep from '../../InputAmountStep'
import { useParams } from 'next/navigation'
import { countryData } from '@/components/AddMoney/consts'
import { MantecaDepositDetails } from '@/types/manteca.types'
import { mantecaApi } from '@/services/manteca'

interface MercadoPagoProps {
    source: 'bank' | 'regionalMethod'
}

type stepType = 'inputAmount' | 'depositDetails'

const MercadoPago: FC<MercadoPagoProps> = ({ source }) => {
    const params = useParams()
    const [step, setStep] = useState<stepType>('inputAmount')
    const [isCreatingDeposit, setIsCreatingDeposit] = useState(false)
    const [tokenAmount, setTokenAmount] = useState('')
    const [tokenUSDAmount, setTokenUSDAmount] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [depositDetails, setDepositDetails] = useState<MantecaDepositDetails>()

    const selectedCountryPath = params.country as string
    const selectedCountry = useMemo(() => {
        return countryData.find((country) => country.type === 'country' && country.path === selectedCountryPath)
    }, [selectedCountryPath])

    const handleAmountSubmit = async () => {
        if (!selectedCountry?.currency) return
        if (isCreatingDeposit) return

        try {
            setError(null)
            setIsCreatingDeposit(true)
            const depositData = await mantecaApi.deposit({
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
            <InputAmountStep
                tokenAmount={tokenAmount}
                setTokenAmount={setTokenAmount}
                onSubmit={handleAmountSubmit}
                selectedCountry={selectedCountry}
                isLoading={isCreatingDeposit}
                error={error}
                setTokenUSDAmount={setTokenUSDAmount}
            />
        )
    }

    if (step === 'depositDetails' && depositDetails) {
        return <MercadoPagoDepositDetails source={source} depositDetails={depositDetails} />
    }

    return null
}

export default MercadoPago
