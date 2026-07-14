'use client'
import ValidatedInput, { type InputUpdate } from '@/components/Global/ValidatedInput'
import type { RecipientType } from '@/interfaces/interfaces'
import { validateBankAccount } from '@/utils/bridge-accounts.utils'
import { formatBankAccountDisplay, sanitizeBankAccount } from '@/utils/format.utils'
import * as Senty from '@sentry/nextjs'
import { useCallback, useRef } from 'react'
import { isIBAN } from 'validator'
import { validateAndResolveRecipient } from '@/lib/validation/recipient'
import { isValidAddressForFamily, type WithdrawAddressFamily } from '@/lib/validation/addressFamily'
import { BASE_URL } from '@/constants/general.consts'

type GeneralRecipientInputProps = {
    className?: string
    placeholder: string
    recipient: { name: string | undefined; address: string }
    onUpdate: (update: GeneralRecipientUpdate) => void
    infoText?: string
    showInfoText?: boolean
    isWithdrawal?: boolean
    /** Address family of the selected withdraw destination ('evm' default).
     *  Solana/Tron short-circuit the IBAN/US-routing/ENS branches — a base58
     *  address is the only valid input for them. */
    addressFamily?: WithdrawAddressFamily
}

export type GeneralRecipientUpdate = {
    recipient: { name: string | undefined; address: string }
    type: RecipientType
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
    isWithdrawal = false,
    addressFamily = 'evm',
}: GeneralRecipientInputProps) => {
    const recipientType = useRef<RecipientType>('address')
    const errorMessage = useRef('')
    const resolvedAddress = useRef('')

    const checkAddress = useCallback(
        async (recipient: string): Promise<boolean> => {
            try {
                let isValid = false
                let type: RecipientType = 'address'

                // trim the input and remove URL prefix if present
                const trimmedInput = recipient.trim().replace(`${BASE_URL}/`, '')
                const sanitizedInput = sanitizeBankAccount(trimmedInput)

                // Non-EVM destination: base58 address or nothing — never IBAN,
                // US-routing, ENS, or username.
                if (addressFamily !== 'evm') {
                    const familyValid = isValidAddressForFamily(trimmedInput, addressFamily)
                    if (familyValid) {
                        resolvedAddress.current = trimmedInput
                    } else {
                        errorMessage.current = `Invalid ${addressFamily === 'solana' ? 'Solana' : 'Tron'} address`
                    }
                    recipientType.current = 'address'
                    return familyValid
                }

                if (isIBAN(sanitizedInput)) {
                    type = 'iban'
                    isValid = await validateBankAccount(sanitizedInput)
                    if (!isValid) errorMessage.current = 'Invalid IBAN, country not supported'
                } else if (/^[0-9]{1,17}$/.test(sanitizedInput)) {
                    type = 'us'
                    isValid = true
                } else {
                    try {
                        const validation = await validateAndResolveRecipient(trimmedInput, isWithdrawal)

                        isValid = true
                        resolvedAddress.current = validation.resolvedAddress
                        type = validation.recipientType.toLowerCase() as RecipientType
                    } catch (error: unknown) {
                        errorMessage.current = (error as Error).message
                        // For withdrawal context, failed non-address inputs should be treated as ENS
                        if (isWithdrawal && !trimmedInput.startsWith('0x')) {
                            type = 'ens'
                        }
                        recipientType.current = type
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
        },
        [isWithdrawal, addressFamily]
    )

    const onInputUpdate = useCallback(
        (update: InputUpdate) => {
            const sanitizedValue =
                recipientType.current === 'iban' || recipientType.current === 'us'
                    ? sanitizeBankAccount(update.value)
                    : update.value.trim().replace(`${BASE_URL}/`, '')

            let _update: GeneralRecipientUpdate
            if (update.isValid) {
                errorMessage.current = ''
                _update = {
                    recipient:
                        'ens' === recipientType.current || (!isWithdrawal && 'username' === recipientType.current)
                            ? { address: resolvedAddress.current, name: sanitizedValue }
                            : { address: sanitizedValue, name: undefined },
                    type: recipientType.current,
                    isValid: true,
                    isChanging: update.isChanging,
                    errorMessage: '',
                }
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
        [isWithdrawal, onUpdate]
    )

    const formatDisplayValue = (value: string) => {
        if (recipientType.current === 'iban' || recipientType.current === 'us') {
            return formatBankAccountDisplay(value, recipientType.current)
        }
        return value
    }

    return (
        <div className="w-full">
            <label className="mb-2 block text-left text-sm font-bold">Wallet address</label>
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
                smartPasteKind="recipient"
            />
        </div>
    )
}

export default GeneralRecipientInput
