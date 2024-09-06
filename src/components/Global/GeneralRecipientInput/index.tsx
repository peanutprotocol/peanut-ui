'use client'
import { useEffect, useState } from 'react'
import { isIBAN } from 'validator'
import Icon from '@/components/Global/Icon'
import * as interfaces from '@/interfaces'
import * as utils from '@/utils'
import { ethers } from 'ethers'

type GeneralRecipientInputProps = {
    className?: string
    placeholder: string
    value: string
    onSubmit: any
    _setIsValidRecipient: any
    setIsValueChanging?: any
    setRecipientType: any
    onDeleteClick: any
}

const GeneralRecipientInput = ({
    placeholder,
    value,
    onSubmit,
    _setIsValidRecipient,
    setIsValueChanging,
    setRecipientType,
    onDeleteClick,
}: GeneralRecipientInputProps) => {
    const [userInput, setUserInput] = useState<string>(value)
    const [recipient, setAddress] = useState<string>(value)
    const [deboundedRecipient, setDeboundedRecipient] = useState<string>('')
    const [isValidRecipient, setIsValidRecipient] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [type, setType] = useState<interfaces.RecipientType>('address')

    async function checkAddress(recipient: string) {
        try {
            if (isIBAN(recipient)) {
                const validAccount = await utils.validateBankAccount(recipient)
                if (validAccount) {
                    setIsValidRecipient(true)
                    _setIsValidRecipient({ isValid: true })
                    setRecipientType('iban')
                    setType('iban')
                    setAddress(recipient)
                    onSubmit(userInput, recipient)
                } else {
                    setIsValidRecipient(false)
                    _setIsValidRecipient({ isValid: false, error: 'Invalid IBAN, country not supported' })
                }
            } else if (/^[0-9]{6,17}$/.test(recipient)) {
                const validateBankAccount = await utils.validateBankAccount(recipient)
                if (validateBankAccount) {
                    setIsValidRecipient(true)
                    _setIsValidRecipient({ isValid: true })
                    setRecipientType('us')
                    setType('us')
                    setAddress(recipient)
                    onSubmit(userInput, recipient)
                } else {
                    setIsValidRecipient(false)
                    _setIsValidRecipient({ isValid: false, error: 'Invalid US account number' })
                }
            } else if (recipient.toLowerCase().endsWith('.eth')) {
                const resolvedAddress = await utils.resolveFromEnsName(recipient.toLowerCase())
                if (resolvedAddress) {
                    recipient = resolvedAddress
                    setIsValidRecipient(true)
                    _setIsValidRecipient({ isValid: true })
                    setAddress(recipient)
                    setRecipientType('ens')
                    setType('ens')
                    onSubmit(userInput, recipient)
                } else {
                    setIsValidRecipient(false)
                    _setIsValidRecipient({ isValid: false })
                }
            } else if (ethers.utils.isAddress(recipient)) {
                setAddress(recipient)
                setIsValidRecipient(true)
                _setIsValidRecipient({ isValid: true })
                setRecipientType('address')
                setType('address')
                onSubmit(undefined, recipient)
            } else {
                setIsValidRecipient(false)
                _setIsValidRecipient({ isValid: false })
            }
        } catch (error) {
            console.error('Error while validating recipient input field:', error)
            setIsValidRecipient(false)
            _setIsValidRecipient({ isValid: false })
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (recipient && isValidRecipient) {
            _setIsValidRecipient({ isValid: true })
        }
    }, [recipient])

    useEffect(() => {
        setIsLoading(true)
        const handler = setTimeout(() => {
            setDeboundedRecipient(userInput)
        }, 750)
        return () => {
            clearTimeout(handler)
        }
    }, [userInput])

    useEffect(() => {
        if (deboundedRecipient) {
            checkAddress(deboundedRecipient)
        }
    }, [deboundedRecipient])

    useEffect(() => {
        setUserInput(value)
    }, [value])

    return (
        <div
            className={`border-n-1 relative w-full max-w-96 border dark:border-white${
                userInput && !isLoading && isValidRecipient
                    ? ' border-n-1 border dark:border-white'
                    : userInput && !isLoading && !isValidRecipient
                      ? ' border-n-1 border-red dark:border-red'
                      : ''
            }`}
        >
            <div className="text-h8 absolute left-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center bg-white font-medium">
                To:
            </div>
            <input
                className={`transition-color text-h8 focus:border-purple-1 dark:bg-n-1 dark:focus:border-purple-1
                h-12 w-full rounded-none bg-transparent bg-white px-4 pl-8 font-medium outline-none placeholder:text-sm dark:border-white dark:text-white dark:placeholder:text-white/75`}
                type="text"
                placeholder={placeholder}
                value={userInput}
                onSubmit={(e) => {
                    e.preventDefault()
                }}
                onChange={(e) => {
                    setIsValueChanging(true)
                    if (e.target.value) {
                        setUserInput(e.target.value)
                    } else {
                        _setIsValidRecipient({ isValid: false })
                        setUserInput('')
                    }
                }}
                spellCheck="false"
            />
            {userInput.length > 0 ? (
                isLoading ? (
                    <div className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center bg-white">
                        <div
                            className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent motion-reduce:animate-none"
                            role="status"
                        />
                    </div>
                ) : (
                    userInput && (
                        <button
                            onClick={(e) => {
                                e.preventDefault()
                                setUserInput('')
                                onDeleteClick()
                            }}
                            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center bg-white"
                        >
                            <Icon className="h-6 w-6 dark:fill-white" name="close" />
                        </button>
                    )
                )
            ) : null}
        </div>
    )
}

export default GeneralRecipientInput
