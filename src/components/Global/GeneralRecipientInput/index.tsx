'use client'
import { useCallback, useRef } from 'react'
import { isIBAN } from 'validator'
import ValidatedInput, { InputUpdate } from '@/components/Global/ValidatedInput'
import * as utils from '@/utils'
import { isAddress } from 'viem'
import * as interfaces from '@/interfaces'
import { useRecentRecipients } from '@/hooks/useRecentRecipients'

type GeneralRecipientInputProps = {
    className?: string
    placeholder: string
    recipient: { name: string | undefined; address: string }
    onUpdate: (update: GeneralRecipientUpdate) => void
}

export type GeneralRecipientUpdate = {
    recipient: { name: string | undefined; address: string }
    type: interfaces.RecipientType
    isValid: boolean
    isChanging: boolean
    errorMessage: string
}

const GeneralRecipientInput = ({ placeholder, recipient, onUpdate, className }: GeneralRecipientInputProps) => {
    const recipientType = useRef<interfaces.RecipientType>('address')
    const errorMessage = useRef('')
    const resolvedAddress = useRef('')
    const { getSuggestions, addRecipient } = useRecentRecipients()

    const checkAddress = useCallback(async (recipient: string): Promise<boolean> => {
        try {
            let isValid = false
            let type: interfaces.RecipientType = 'address'
            if (isIBAN(recipient)) {
                type = 'iban'
                isValid = await utils.validateBankAccount(recipient)
                if (!isValid) errorMessage.current = 'Invalid IBAN, country not supported'
            } else if (/^[0-9]{6,26}$/.test(recipient)) {
                // routing number: 9 digits
                // account number: 8-12 digits (can go up to 17)
                type = 'us'
                isValid = await utils.validateBankAccount(recipient)
                if (!isValid) errorMessage.current = 'Invalid US account number'
            } else if (recipient.toLowerCase().endsWith('.eth')) {
                type = 'ens'
                const address = await utils.resolveFromEnsName(recipient.toLowerCase())
                if (address) {
                    resolvedAddress.current = address
                    isValid = true
                } else {
                    errorMessage.current = 'ENS not found'
                    isValid = false
                }
            } else {
                type = 'address'
                isValid = isAddress(recipient, { strict: false })
                if (!isValid) errorMessage.current = 'Invalid address'
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
            let _update: GeneralRecipientUpdate
            if (update.isValid) {
                errorMessage.current = ''
                _update = {
                    recipient:
                        'ens' === recipientType.current
                            ? { address: resolvedAddress.current, name: update.value }
                            : { address: update.value, name: undefined },
                    type: recipientType.current,
                    isValid: true,
                    isChanging: update.isChanging,
                    errorMessage: '',
                }
                addRecipient(update.value, recipientType.current)
            } else {
                resolvedAddress.current = ''
                _update = {
                    recipient: { address: update.value, name: undefined },
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

    return (
        <ValidatedInput
            placeholder={placeholder}
            label="To"
            value={recipient.name ?? recipient.address}
            debounceTime={750}
            validate={checkAddress}
            onUpdate={onInputUpdate}
            className={className}
            autoComplete="on"
            name="bank-account"
            suggestions={getSuggestions(recipientType.current)}
        />
    )
}

export default GeneralRecipientInput
