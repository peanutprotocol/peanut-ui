'use client'
import ValidatedInput, { InputUpdate } from '@/components/Global/ValidatedInput'
import { useRecentRecipients } from '@/hooks/useRecentRecipients'
import * as interfaces from '@/interfaces'
import { validateBankAccount } from '@/utils'
import { formatBankAccountDisplay, sanitizeBankAccount } from '@/utils/format.utils'
import * as Senty from '@sentry/nextjs'
import { useCallback, useRef } from 'react'
import { isIBAN } from 'validator'
import { validateAndResolveRecipient } from '@/lib/validation/recipient'
import { BASE_URL } from '@/constants'

type GeneralRecipientInputProps = {
    className?: string
    placeholder: string
    recipient: { name: string | undefined; address: string }
    onUpdate: (update: GeneralRecipientUpdate) => void
    infoText?: string
    showInfoText?: boolean
}

export type GeneralRecipientUpdate = {
    recipient: { name: string | undefined; address: string }
    type: interfaces.RecipientType
    isValid: boolean
    isChanging: boolean
    errorMessage: string
}

const GeneralRecipientInput = ({
    placeholder,
    recipient,
    onUpdate,
    className,
    infoText,
    showInfoText = true,
}: GeneralRecipientInputProps) => {
    const recipientType = useRef<interfaces.RecipientType>('address')
    const errorMessage = useRef('')
    const resolvedAddress = useRef('')
    const { addRecipient } = useRecentRecipients()

    const checkAddress = useCallback(async (recipient: string): Promise<boolean> => {
        try {
            let isValid = false
            let type: interfaces.RecipientType = 'address'

            const trimmedInput = recipient.trim().replace(`${BASE_URL}/`, '')
            const sanitizedInput = sanitizeBankAccount(trimmedInput)

            if (isIBAN(sanitizedInput)) {
                type = 'iban'
                isValid = await validateBankAccount(sanitizedInput)
                if (!isValid) errorMessage.current = 'Invalid IBAN, country not supported'
            } else if (/^[0-9]{1,17}$/.test(sanitizedInput)) {
                type = 'us'
                isValid = true
            } else {
                try {
                    const validation = await validateAndResolveRecipient(trimmedInput)
                    
                    // Only accept ENS accounts, reject usernames
                    if (validation.recipientType.toLowerCase() === 'username') {
                        errorMessage.current = 'Peanut usernames are not supported for withdraws. Please enter a valid address or go to the "Send" page.'
                        return false
                    }
                    
                    isValid = true
                    resolvedAddress.current = validation.resolvedAddress
                    type = validation.recipientType.toLowerCase() as interfaces.RecipientType
                } catch (error: unknown) {
                    errorMessage.current = (error as Error).message
                    return false
                }
            }
            recipientType.current = type
            return isValid
        } catch (error) {
            console.error('Error while validating recipient input field:', error)
            Senty.captureException(error)
            return false
        }
    }, [])

    const onInputUpdate = useCallback(
        (update: InputUpdate) => {
            const sanitizedValue =
                recipientType.current === 'iban' || recipientType.current === 'us'
                    ? sanitizeBankAccount(update.value)
                    : update.value.trim().replace(`${BASE_URL}/`, '')

            let _update: GeneralRecipientUpdate
            if (update.isValid) {
                errorMessage.current = ''
                _update = { //the logic is here to avoid adding ens and username to the recent recipients IF THIS IS A WITHDRAWAL
                    recipient:
                        'ens' === recipientType.current
                            ? { address: resolvedAddress.current, name: sanitizedValue }
                            : { address: sanitizedValue, name: undefined },
                    type: recipientType.current,
                    isValid: true,
                    isChanging: update.isChanging,
                    errorMessage: '',
                }
                addRecipient(sanitizedValue, recipientType.current)
            } else {
                resolvedAddress.current = ''
                _update = {
                    recipient: { address: sanitizedValue, name: undefined },
                    type: recipientType.current,
                    isValid: false,
                    isChanging: update.isChanging,
                    errorMessage: errorMessage.current,
                }
            }
            onUpdate(_update)
        },
        [addRecipient]
    )

    const formatDisplayValue = (value: string) => {
        if (recipientType.current === 'iban' || recipientType.current === 'us') {
            return formatBankAccountDisplay(value, recipientType.current)
        }
        return value
    }

    return (
        <div className="w-full">
            <label className="mb-2 block text-left text-sm font-bold">Where do you want to receive this?</label>
            <ValidatedInput
                value={recipient.name ?? recipient.address}
                placeholder={placeholder}
                validate={checkAddress}
                onUpdate={onInputUpdate}
                className={className}
                autoComplete="on"
                name="bank-account"
                infoText={showInfoText ? infoText : undefined}
                formatDisplayValue={formatDisplayValue}
            />
        </div>
    )
}

export default GeneralRecipientInput
