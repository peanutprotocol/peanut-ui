'use client'
import { useEffect, useState } from 'react'
import Icon from '@/components/Global/Icon'
import * as utils from '@/utils'
import { ethers } from 'ethers'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import classNames from 'classnames'

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
                    setRecipient(recipient)
                    setIsValidRecipient(true)
                    setType('ens')
                    onSubmit(recipient)
                } else {
                    setIsValidRecipient(false)
                }
            } else if (ethers.utils.isAddress(recipient)) {
                setRecipient(recipient)
                setIsValidRecipient(true)
                setType('address')
                onSubmit(recipient)
            } else {
                setIsValidRecipient(false)
            }
        } catch (error) {
            console.error('Error while validating recipient input field:', error)
            setIsValidRecipient(false)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        _setIsValidRecipient(isValidRecipient)
    }, [isValidRecipient])

    useEffect(() => {
        if (recipient && isValidRecipient) {
            onSubmit(recipient)
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
        <div className={classNames('relative w-full', {})}>
            <div className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center bg-white">
                <Icon name="send" className="h-4 w-4 dark:fill-white" />
            </div>
            <BaseInput
                type="text"
                placeholder={placeholder}
                className={classNames('pl-12', {
                    'border-red-1': userInput && !isLoading && !isValidRecipient,
                })}
                value={userInput}
                onSubmit={(e) => {
                    e.preventDefault()
                }}
                onChange={(e) => {
                    setIsValueChanging(true)
                    if (e.target.value) {
                        setUserInput(e.target.value)
                    } else {
                        setIsValidRecipient(false)
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
                                setIsValidRecipient(false)
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
