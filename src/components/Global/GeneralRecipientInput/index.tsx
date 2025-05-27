'use client'
import { resolveEns } from '@/app/actions/ens'
import ValidatedInput, { InputUpdate } from '@/components/Global/ValidatedInput'
import { useRecentRecipients } from '@/hooks/useRecentRecipients'
import * as interfaces from '@/interfaces'
import { validateBankAccount, validateEnsName } from '@/utils'
import { formatBankAccountDisplay, sanitizeBankAccount } from '@/utils/format.utils'
import * as Senty from '@sentry/nextjs'
import { useCallback, useRef } from 'react'
import { isIBAN } from 'validator'
import { isAddress } from 'viem'

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

            const trimmedInput = recipient.trim()
            const sanitizedInput = sanitizeBankAccount(trimmedInput)

            if (isIBAN(sanitizedInput)) {
                type = 'iban'
                isValid = await validateBankAccount(sanitizedInput)
                if (!isValid) errorMessage.current = 'Invalid IBAN, country not supported'
            } else if (/^[0-9]{1,17}$/.test(sanitizedInput)) {
                type = 'us'
                isValid = true
            } else if (validateEnsName(trimmedInput)) {
                type = 'ens'
                const address = await resolveEns(trimmedInput.toLowerCase())
                if (address) {
                    resolvedAddress.current = address
                    isValid = true
                } else {
                    errorMessage.current = 'ENS name not found'
                    isValid = false
                }
            } else {
                type = 'address'
                isValid = isAddress(trimmedInput)
                if (!isValid) errorMessage.current = 'Invalid Ethereum address'
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
