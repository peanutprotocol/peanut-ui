'use client'

import { useEffect, useState } from 'react'
import validator from 'validator'
import { parsePhoneNumberFromString } from 'libphonenumber-js'

import * as _consts from '../Create.consts'
import * as _utils from '../Create.utils'
import * as utils from '@/utils'
import RecipientInput from '@/components/Global/RecipientInput'
import Icon from '@/components/Global/Icon'
import { ethers } from 'ethers'
import peanut from '@squirrel-labs/peanut-sdk'

export const CreateLinkInitialView = ({ onNext, createType, setCreateType }: _consts.ICreateScreenProps) => {
    const [inputValue, setInputValue] = useState('')
    const [address, setAddress] = useState<string | undefined>(undefined)

    const handleInputValidation = (value: string) => {
        const phoneNumber = parsePhoneNumberFromString(value)
        //email check
        if (validator.isEmail(value)) setCreateType('email_link')
        //phone number check
        else if (phoneNumber && phoneNumber.isValid()) {
            console.log(phoneNumber.formatInternational()) // +1 213 373 4253
            setCreateType('sms_link')
        } //TODO: Add more validation checks for normal numbers without country code
        //address check
        else if (ethers.utils.isAddress(value)) setCreateType('direct')
        //ENS check
        else if (value.endsWith('.eth')) {
            setCreateType('direct')
            utils.resolveFromEnsName(value).then((resolvedAddress) => {
                if (resolvedAddress) setAddress(resolvedAddress)
            })
        } else {
            setCreateType(undefined)
        }
    }

    useEffect(() => {
        handleInputValidation(inputValue)
    }, [inputValue])

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            <label className="text-h2">Send crypto via link</label>
            <label className="max-w-96 text-start text-h8 font-light">
                Deposit some crypto to the link, no need for wallet addresses. Send the link to the recipient. They will
                be able to claim the funds in any token on any chain from the link.
            </label>
            <div className="flex w-full  flex-col items-center justify-center gap-2">
                <RecipientInput placeholder="email/phone/ens/address" value={inputValue} setValue={setInputValue} />
                {inputValue.length === 0 && (
                    <>
                        {' '}
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
                <div className="flex w-full flex-col items-start justify-center gap-2">
                    <label className="text-h7 font-bold text-gray-2">Search results</label>
                    <div
                        className={`flex w-full cursor-pointer flex-row items-center justify-start gap-2 border border-n-1 p-1 px-2 ${
                            !createType && 'border-red'
                        }`}
                        onClick={() => {
                            switch (createType) {
                                case 'email_link':
                                    setCreateType('email_link')
                                    onNext()
                                    break
                                case 'sms_link':
                                    setCreateType('sms_link')
                                    onNext()
                                    break
                                case 'direct':
                                    setCreateType('direct')
                                    onNext()
                                    break
                            }
                        }}
                    >
                        <div className="rounded-full border border-n-1">
                            {createType === 'email_link' && <Icon name="email" className="h-6 w-6 dark:fill-white" />}
                            {createType === 'sms_link' && <Icon name="mobile" className="h-6 w-6 dark:fill-white" />}
                            {createType === 'direct' && (
                                <Icon name="send" className="h-6 w-6 -rotate-45 dark:fill-white" />
                            )}
                            {!createType && <Icon name="close" className="h-6 w-6 dark:fill-white" />}
                        </div>
                        <div>
                            <label className="text-h7 "> {inputValue}</label>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
