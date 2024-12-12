'use client'
import { useCallback, useRef } from 'react'
import { isIBAN } from 'validator'
import ValidatedInput, { InputUpdate } from '@/components/Global/ValidatedInput'
import * as utils from '@/utils'
import { isAddress } from 'viem'
import * as interfaces from '@/interfaces'
import { useRecentRecipients } from '@/hooks/useRecentRecipients'
import { sanitizeBankAccount, formatBankAccountDisplay } from '@/utils/format.utils'

type GeneralRecipientInputProps = {
    className?: string
    placeholder: string
    recipient: { name: string | undefined; address: string }
    onUpdate: (update: GeneralRecipientUpdate) => void
    infoText?: string
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
}: GeneralRecipientInputProps) => {
    const recipientType = useRef<interfaces.RecipientType>('address')
    const errorMessage = useRef('')
    const resolvedAddress = useRef('')
    const { getSuggestions, addRecipient } = useRecentRecipients()

    const checkAddress = useCallback(async (recipient: string): Promise<boolean> => {
        try {
            let isValid = false
            let type: interfaces.RecipientType = 'address'

            const trimmedInput = recipient.trim()
            const sanitizedInput = sanitizeBankAccount(trimmedInput)

            if (isIBAN(sanitizedInput)) {
                type = 'iban'
                isValid = await utils.validateBankAccount(sanitizedInput)
                if (!isValid) errorMessage.current = 'Invalid IBAN, country not supported'
            } else if (/^[0-9]{1,17}$/.test(sanitizedInput)) {
                type = 'us'
                isValid = true
            } else if (trimmedInput.toLowerCase().endsWith('.eth')) {
                type = 'ens'
                const address = await utils.resolveFromEnsName(trimmedInput.toLowerCase())
                if (address) {
                    resolvedAddress.current = address
                    isValid = true
                } else {
                    errorMessage.current = 'ENS name not found'
                    isValid = false
                }
            } else {
                type = 'address'
                isValid = isAddress(trimmedInput, { strict: false })
                if (!isValid) errorMessage.current = 'Invalid Ethereum address'
            }
            recipientType.current = type
            return isValid
        } catch (error) {
            console.error('Error while validating recipient input field:', error)
            return false
        }
    }, [])

    const onInputUpdate = useCallback(
        (update: InputUpdate) => {
            const sanitizedValue =
                recipientType.current === 'iban' || recipientType.current === 'us'
                    ? sanitizeBankAccount(update.value)
                    : update.value.trim()

            let _update: GeneralRecipientUpdate
            if (update.isValid) {
                errorMessage.current = ''
                _update = {
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
        <ValidatedInput
            label="To"
            value={recipient.name ?? recipient.address}
            placeholder={placeholder}
            validate={checkAddress}
            onUpdate={onInputUpdate}
            className={className}
            autoComplete="on"
            name="bank-account"
            suggestions={getSuggestions(recipientType.current)}
            infoText={infoText}
            formatDisplayValue={formatDisplayValue}
        />
    )
}

export default GeneralRecipientInput
