import React, { useMemo, useState } from 'react'
import MercadoPagoDepositDetails from './MercadoPagoDepositDetails'
import InputAmountStep from '../../InputAmountStep'
import { createMantecaOnramp } from '@/app/actions/onramp'
import { useParams } from 'next/navigation'
import { countryData } from '@/components/AddMoney/consts'

const MercadoPago = () => {
    const params = useParams()
    const [step, setStep] = useState('inputAmount')
    const [isCreatingDeposit, setIsCreatingDeposit] = useState(false)
    const [tokenAmount, setTokenAmount] = useState('')
    const [error, setError] = useState<string | null>(null)

    const selectedCountryPath = params.country as string
    const selectedCountry = useMemo(() => {
        if (!selectedCountryPath) return null
        return countryData.find((country) => country.type === 'country' && country.path === selectedCountryPath)
    }, [selectedCountryPath])

    const handleAmountSubmit = async () => {
        if (!selectedCountry?.currency) return

        try {
            setError(null)
            setIsCreatingDeposit(true)
            const depositData = await createMantecaOnramp({
                usdAmount: tokenAmount.replace(/,/g, ''),
                currency: selectedCountry.currency,
            })
            if (depositData.error) {
                setError(depositData.error)
                return
            }
            setStep('depositDetails')
        } catch (error) {
            console.log(error)
            setError(error as string)
        } finally {
            setIsCreatingDeposit(false)
        }
    }

    if (step === 'inputAmount') {
        return (
            <InputAmountStep
                tokenAmount={tokenAmount}
                setTokenAmount={setTokenAmount}
                onSubmit={handleAmountSubmit}
                selectedCountry={selectedCountry}
                isLoading={isCreatingDeposit}
                error={error}
            />
        )
    }

    return <MercadoPagoDepositDetails />
}

export default MercadoPago
