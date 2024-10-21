'use client'
import { useCallback, useRef } from 'react'
import { isIBAN } from 'validator'
import ValidatedInput, { InputUpdate } from '@/components/Global/ValidatedInput'
import * as utils from '@/utils'
import { ethers } from 'ethers'
import * as interfaces from '@/interfaces'

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

    const checkAddress = useCallback(async (recipient: string): Promise<boolean> => {
        try {
            if (isIBAN(recipient)) {
                const validAccount = await utils.validateBankAccount(recipient)
                recipientType.current = 'iban'
                if (validAccount) {
                    return true
                } else {
                    errorMessage.current = 'Invalid IBAN, country not supported'
                    return false
                }
            } else if (/^[0-9]{6,17}$/.test(recipient)) {
                const validateBankAccount = await utils.validateBankAccount(recipient)
                recipientType.current = 'us'
                if (validateBankAccount) {
                    return true
                } else {
                    errorMessage.current = 'Invalid US account number'
                    return false
                }
            } else if (recipient.toLowerCase().endsWith('.eth')) {
                const address = await utils.resolveFromEnsName(recipient.toLowerCase())
                recipientType.current = 'ens'
                if (address) {
                    resolvedAddress.current = address
                    return true
                } else {
                    errorMessage.current = 'ENS not found'
                    return false
                }
            } else if (ethers.utils.isAddress(recipient)) {
                recipientType.current = 'address'
                return true
            } else {
                recipientType.current = 'address'
                errorMessage.current = 'Invalid address'
                return false
            }
        } catch (error) {
            console.error('Error while validating recipient input field:', error)
            return false
        }
    }, [])

    const onInputUpdate = useCallback((update: InputUpdate) => {
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
    }, [])

    return (
        <ValidatedInput
            placeholder={placeholder}
            label="To"
            value={recipient.name ?? recipient.address}
            debounceTime={750}
            validate={checkAddress}
            onUpdate={onInputUpdate}
            className={className}
        />
    )
}

export default GeneralRecipientInput
