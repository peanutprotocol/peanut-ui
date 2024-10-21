'use client'
import { isAddress } from 'viem'

import { resolveFromEnsName } from '@/utils'
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
            if (recipient.toLowerCase().endsWith('.eth')) {
                const resolvedAddress = await resolveFromEnsName(recipient.toLowerCase())
                return !!resolvedAddress
            } else {
                return isAddress(recipient, { strict: false })
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
