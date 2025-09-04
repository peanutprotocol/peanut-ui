import React, { useMemo, useState } from 'react'
import MercadoPagoDepositDetails from './MercadoPagoDepositDetails'
import InputAmountStep from '../../InputAmountStep'
import { createMantecaOnramp } from '@/app/actions/onramp'
import { useParams } from 'next/navigation'
import { countryData } from '@/components/AddMoney/consts'
import { MantecaDepositDetails } from '@/types/manteca.types'

const MercadoPago = () => {
    const params = useParams()
    const [step, setStep] = useState('inputAmount')
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
            setError(error as string)
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
        return <MercadoPagoDepositDetails depositDetails={depositDetails} />
    }

    return null
}

export default MercadoPago
