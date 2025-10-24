'use client'

import { Button } from '@/components/0_Bruddle'
import { Icon } from '@/components/Global/Icons/Icon'
import { MercadoPagoStep } from '@/types/manteca.types'
import { type Dispatch, type FC, type SetStateAction, useState } from 'react'
import { MANTECA_COUNTRIES_CONFIG } from '@/constants'
import ValidatedInput from '@/components/Global/ValidatedInput'
import { validateCbuCvuAlias } from '@/utils/withdraw.utils'
import ErrorAlert from '@/components/Global/ErrorAlert'

interface MantecaDetailsStepProps {
    setCurrentStep: Dispatch<SetStateAction<MercadoPagoStep>>
    destinationAddress: string
    setDestinationAddress: Dispatch<SetStateAction<string>>
}

const MantecaDetailsStep: FC<MantecaDetailsStepProps> = ({
    setCurrentStep,
    destinationAddress,
    setDestinationAddress,
}) => {
    const handleOnClick = async () => {
        setCurrentStep(MercadoPagoStep.REVIEW)
    }
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isDestinationAddressValid, setIsDestinationAddressValid] = useState(false)
    const [isDestinationAddressChanging, setIsDestinationAddressChanging] = useState(false)

    const countryConfig = MANTECA_COUNTRIES_CONFIG['AR']

    const validateDestinationAddress = async (value: string) => {
        value = value.trim()
        if (!value) {
            return false
        }
        const { valid, message } = validateCbuCvuAlias(value)
        if (!valid) {
            setErrorMessage(message!)
        }
        return valid
    }

    return (
        <>
            <p className="font-bold">Enter account details</p>

            <ValidatedInput
                value={destinationAddress}
                onUpdate={(update) => {
                    setDestinationAddress(update.value)
                    setIsDestinationAddressValid(update.isValid)
                    setIsDestinationAddressChanging(update.isChanging)
                    if (update.isValid || update.value === '') {
                        setErrorMessage(null)
                    }
                }}
                placeholder={countryConfig.accountNumberLabel}
                validate={validateDestinationAddress}
            />
            <div className="flex items-center gap-2 text-xs text-grey-1">
                <Icon name="info" width={16} height={16} />
                <span>You can only withdraw to accounts under your name.</span>
            </div>
            {errorMessage && <ErrorAlert description={errorMessage} />}
            <Button
                disabled={
                    !destinationAddress || !isDestinationAddressValid || !!errorMessage || isDestinationAddressChanging
                }
                onClick={() => handleOnClick()}
                shadowSize="4"
            >
                Review
            </Button>
        </>
    )
}

export default MantecaDetailsStep
