'use client'
import { useEffect, useState } from 'react'
import Icon from '@/components/Global/Icon'
import * as utils from '@/utils'
import { ethers } from 'ethers'

type AddressInputProps = {
    className?: string
    placeholder: string
    value: string
    onSubmit: any
    _setIsValidRecipient: any
    setIsValueChanging?: any
    onDeleteClick: any
}

const AddressInput = ({
    placeholder,
    value,
    onSubmit,
    _setIsValidRecipient,
    setIsValueChanging,
    onDeleteClick,
}: AddressInputProps) => {
    const [userInput, setUserInput] = useState<string>(value)
    const [recipient, setRecipient] = useState<string>(value)
    const [debouncedRecipient, setDebouncedRecipient] = useState<string>('')
    const [isValidRecipient, setIsValidRecipient] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [type, setType] = useState<'address' | 'ens'>('address')

    async function checkAddress(recipient: string) {
        try {
            if (recipient.toLowerCase().endsWith('.eth')) {
                const resolvedAddress = await utils.resolveFromEnsName(recipient.toLowerCase())
                if (resolvedAddress) {
                    setRecipient(resolvedAddress)
                    setIsValidRecipient(true)
                    _setIsValidRecipient(true)
                    setType('ens')
                    onSubmit(userInput, recipient)
                } else {
                    setIsValidRecipient(false)
                    _setIsValidRecipient(false)
                }
            } else if (ethers.utils.isAddress(recipient)) {
                setRecipient(recipient)
                setIsValidRecipient(true)
                _setIsValidRecipient(true)
                setType('address')
                onSubmit(undefined, recipient)
            } else {
                setIsValidRecipient(false)
                _setIsValidRecipient(false)
            }
        } catch (error) {
            console.error('Error while validating recipient input field:', error)
            setIsValidRecipient(false)
            _setIsValidRecipient(false)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (recipient && isValidRecipient) {
            onSubmit(type === 'ens' ? userInput : undefined, recipient)
            _setIsValidRecipient(true)
        }
    }, [recipient])

    useEffect(() => {
        setIsLoading(true)
        const handler = setTimeout(() => {
            setDebouncedRecipient(userInput)
        }, 750)
        return () => {
            clearTimeout(handler)
        }
    }, [userInput])

    useEffect(() => {
        if (debouncedRecipient) {
            checkAddress(debouncedRecipient)
        }
    }, [debouncedRecipient])

    useEffect(() => {
        setUserInput(value)
    }, [value])

    return (
        <div
            className={`relative w-full max-w-96 border border-n-1 dark:border-white${
                userInput && !isLoading && isValidRecipient
                    ? ' border border-n-1 dark:border-white'
                    : userInput && !isLoading && !isValidRecipient
                      ? ' border-n-1 border-red dark:border-red'
                      : ''
            }`}
        >
            <div className="absolute left-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center bg-white text-h8 font-medium">
                To:
            </div>
            <input
                className={`transition-color h-12 w-full rounded-none bg-transparent
                bg-white px-4 pl-8 text-h8 font-medium outline-none placeholder:text-sm focus:border-purple-1 dark:border-white dark:bg-n-1 dark:text-white dark:placeholder:text-white/75 dark:focus:border-purple-1`}
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
                        _setIsValidRecipient(false)
                        setUserInput('')
                    }
                }}
                spellCheck="false"
            />
            {userInput?.length > 0 ? (
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

export default AddressInput
