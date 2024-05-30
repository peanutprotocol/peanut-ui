'use client'

import { useContext, useEffect, useState } from 'react'
import validator from 'validator'
import { parsePhoneNumberFromString } from 'libphonenumber-js'

import * as _consts from '../Create.consts'
import * as _utils from '../Create.utils'
import * as utils from '@/utils'
import * as context from '@/context'
import RecipientInput from '@/components/Global/RecipientInput'
import Icon from '@/components/Global/Icon'
import { ethers } from 'ethers'
import peanut from '@squirrel-labs/peanut-sdk'
import Loading from '@/components/Global/Loading'

export const CreateLinkInitialView = ({ onNext, setCreateType, setRecipient }: _consts.ICreateScreenProps) => {
    const [inputValue, setInputValue] = useState('')
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const { setLoadingState, isLoading } = useContext(context.loadingStateContext)

    const handleInputValidation = async (value: string) => {
        const phoneNumber = parsePhoneNumberFromString(value)
        //email check
        if (validator.isEmail(value)) {
            return 'email_link'
        }
        //phone number check
        else if (phoneNumber && phoneNumber.isValid()) {
            return 'sms_link'
        } //TODO: Add more validation checks for normal numbers without country code
        //address check
        else if (ethers.utils.isAddress(value)) {
            return 'direct'
        }
        //ENS check
        else if (value.endsWith('.eth')) {
            return 'direct'
        } else {
            return undefined
        }
    }

    const handleOnNext = async () => {
        setLoadingState('Loading')
        try {
            let type: string | undefined = undefined
            if (inputValue) {
                type = await handleInputValidation(inputValue)
            }

            if (!type) {
                setErrorState({
                    showError: true,
                    errorMessage:
                        'Invalid recipient. You can send to an ENS name, wallet address, phone number or email address.',
                })
                setLoadingState('Idle')
                return
            } else {
                setErrorState({ showError: false, errorMessage: '' })
            }

            setRecipient(inputValue)
            switch (type) {
                case 'email_link':
                    setCreateType('email_link')
                    setRecipient(inputValue)
                    setLoadingState('Idle')
                    break
                case 'sms_link':
                    setCreateType('sms_link')
                    setRecipient(inputValue)
                    setLoadingState('Idle')
                    break
                case 'direct':
                    setCreateType('direct')
                    if (inputValue.endsWith('.eth')) {
                        const _address = await utils.resolveFromEnsName(inputValue)
                        if (_address) setRecipient(_address)
                        else {
                            setErrorState({
                                showError: true,
                                errorMessage: 'Please enter a valid address or ENS name.',
                            })
                            setLoadingState('Idle')
                            return
                        }
                    } else {
                        setRecipient(inputValue)
                    }
                    setLoadingState('Idle')
                    break
            }
            onNext()
        } catch (error) {
            setLoadingState('Idle')
        }
    }

    useEffect(() => {
        setErrorState({ showError: false, errorMessage: '' })
    }, [inputValue])

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            <label className="text-h2">Send crypto</label>
            <label className="max-w-96 text-start text-h8 font-light">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
                dolore magna aliqua.
            </label>
            <div className="flex w-full  flex-col items-center justify-center gap-2">
                <RecipientInput
                    placeholder="email/phone/ens/address"
                    value={inputValue}
                    setValue={setInputValue}
                    onEnter={() => {
                        if (inputValue.length > 0) handleOnNext()
                    }}
                />
                {inputValue.length === 0 && (
                    <>
                        or
                        <button
                            onClick={() => {
                                setCreateType('link')
                                onNext()
                            }}
                            className="btn h-max w-full cursor-pointer py-1"
                        >
                            Create link
                        </button>
                    </>
                )}
            </div>
            {inputValue.length > 0 && (
                <div className="flex w-full flex-col items-start  justify-center gap-2">
                    <label className="text-h7 font-bold text-gray-2">Search results</label>
                    <div
                        className="flex w-full cursor-pointer flex-row items-center justify-between border border-n-1 p-2"
                        onClick={() => {
                            handleOnNext()
                        }}
                    >
                        <div className="flex max-w-full flex-row items-center justify-center gap-2 overflow-hidden text-h7">
                            <div className="rounded-full border border-n-1">
                                <Icon name="profile" className="h-6 w-6" />
                            </div>
                            <div className="truncate">{inputValue}</div>
                        </div>
                        {isLoading && <Loading />}
                    </div>
                    {errorState.showError && (
                        <div className="w-full text-center">
                            <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
