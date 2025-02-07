'use client'
import { isAddress } from 'viem'

import { resolveFromEnsName, validateEnsName } from '@/utils'
import ValidatedInput, { InputUpdate } from '@/components/Global/ValidatedInput'

type AddressInputProps = {
    placeholder: string
    value: string
    onUpdate: (update: InputUpdate) => void
    className?: string
}

const AddressInput = ({ placeholder = 'Enter a valid address', value, onUpdate, className }: AddressInputProps) => {
    async function checkAddress(recipient: string): Promise<boolean> {
        try {
            if (validateEnsName(recipient)) {
                const resolvedAddress = await resolveFromEnsName(recipient.toLowerCase())
                return !!resolvedAddress
            } else {
                return isAddress(recipient)
            }
        } catch (error) {
            console.error('Error while validating recipient input field:', error)
            return false
        }
    }
    return (
        <ValidatedInput
            placeholder={placeholder}
            label="To"
            value={value}
            debounceTime={750}
            validate={checkAddress}
            onUpdate={onUpdate}
            className={className}
        />
    )
}

export default AddressInput
