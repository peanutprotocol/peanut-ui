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
import { errors, ethers } from 'ethers'
import peanut from '@squirrel-labs/peanut-sdk'
import Loading from '@/components/Global/Loading'
import { validate } from 'multicoin-address-validator'
import { useAccount } from 'wagmi'

export const CreateLinkInitialView = ({
    onNext,
    setCreateType,
    setRecipient,
    recentRecipients,
}: _consts.ICreateScreenProps) => {
    const [inputValue, setInputValue] = useState('')
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const { setLoadingState, isLoading } = useContext(context.loadingStateContext)
    const { isConnected } = useAccount()

    const handleInputValidation = async (value: string) => {
        //email check
        if (validator.isEmail(value)) {
            return 'email_link'
        }
        //phone number check
        else if (value.startsWith('+') || (utils.isNumeric(value) && value.length > 4)) {
            return 'sms_link'
        } //TODO: Add more validation checks for normal numbers without country code
        //address check
        else if (ethers.utils.isAddress(value)) {
            return 'direct'
        }
        //ENS check
        else if (value.endsWith('.eth')) {
            return 'direct'
        } else if (validate(value, 'sol')) {
            setErrorState({
                showError: true,
                errorMessage: 'We currently dont support Solana. Reach out if you would like us to add support!',
            })
            return undefined
        } else if (validate(value, 'btc')) {
            setErrorState({
                showError: true,
                errorMessage: 'We currently dont support Bitcoin. Reach out if you would like us to add support!',
            })

            return undefined
        } else if (validate(value, 'ltc')) {
            setErrorState({
                showError: true,
                errorMessage: 'We currently dont support Litecoin. Reach out if you would like us to add support!',
            })

            return undefined
        } else if (validate(value, 'trx')) {
            setErrorState({
                showError: true,
                errorMessage: 'We currently dont support Tron. Reach out if you would like us to add support!',
            })

            return undefined
        } else {
            setErrorState({
                showError: true,
                errorMessage:
                    'Invalid recipient. You can send to an ENS name, wallet address, phone number or email address.',
            })
            return undefined
        }
    }

    const handleOnNext = async (_inputValue?: string) => {
        setLoadingState('Loading')
        try {
            let type: string | undefined = undefined
            if (inputValue.length > 0) {
                type = await handleInputValidation(inputValue)
            } else if (_inputValue) {
                type = await handleInputValidation(_inputValue)
            }

            if (!type) {
                setLoadingState('Idle')
                return
            } else {
                setErrorState({ showError: false, errorMessage: '' })
            }

            switch (type) {
                case 'email_link':
                    setCreateType('email_link')
                    setRecipient({ name: inputValue, address: undefined })
                    setLoadingState('Idle')
                    break
                case 'sms_link':
                    setCreateType('sms_link')
                    setRecipient({ name: inputValue, address: undefined })
                    setLoadingState('Idle')
                    break
                case 'direct':
                    setCreateType('direct')
                    if (inputValue.endsWith('.eth')) {
                        const _address = await utils.resolveFromEnsName(inputValue)
                        if (_address) setRecipient({ name: inputValue, address: _address })
                        else {
                            setErrorState({
                                showError: true,
                                errorMessage: 'Please enter a valid address or ENS name.',
                            })
                            setLoadingState('Idle')
                            return
                        }
                    } else {
                        if (inputValue.length > 0) {
                            setRecipient({ name: undefined, address: inputValue })
                        } else if (_inputValue) {
                            setRecipient({ name: undefined, address: _inputValue })
                        }
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
            {/* <button
                onClick={() => {
                    utils.shareToSms('+32475385638', 'link')
                }}
                className="btn h-max w-full cursor-pointer py-1 text-h1"
            >
                test sms
            </button>
            <button
                onClick={() => {
                    utils.shareToEmail('borcherd@me.com', 'link')
                }}
                className="btn h-max w-full cursor-pointer py-1 text-h1"
            >
                test email
            </button> */}

            <label className="max-w-96 text-start text-h8 font-light">
                Transfer tokens via link or to an email, phone number, ENS, or wallet address.
            </label>
            <div className="flex w-full  flex-col items-center justify-center gap-2">
                <button
                    onClick={() => {
                        setCreateType('link')
                        onNext()
                    }}
                    className="btn btn-purple h-10 w-full px-2 text-lg "
                >
                    Send via link
                </button>
                or
                <RecipientInput
                    placeholder="Email / Phone / ENS / wallet address"
                    value={inputValue}
                    setValue={setInputValue}
                    onEnter={() => {
                        if (inputValue.length > 0) handleOnNext()
                    }}
                />
            </div>
            {inputValue.length > 0 ? (
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
                </div>
            ) : (
                isConnected &&
                (recentRecipients.length > 0 ? (
                    <div className="flex w-full flex-col items-start  justify-center gap-2">
                        <label className="text-h7 font-bold text-gray-2">Recents</label>
                        {recentRecipients.map((recipient) => (
                            <div
                                key={recipient.address}
                                className="flex h-10 w-full cursor-pointer flex-row items-center justify-between border border-n-1 p-2 transition-colors hover:bg-n-3/10"
                                onClick={() => {
                                    handleOnNext(recipient.address)
                                }}
                            >
                                <div className="flex w-full flex-row items-center justify-between overflow-hidden text-h7">
                                    <div className="flex flex-row items-center justify-start gap-2">
                                        <div className="rounded-full border border-n-1">
                                            <Icon name="profile" className="h-6 w-6" />
                                        </div>
                                        <div className="truncate">{utils.shortenAddressLong(recipient.address, 6)}</div>
                                    </div>
                                    <label className="font-normal">
                                        {' '}
                                        {recipient.count} {recipient.count > 1 ? 'transfers' : 'transfer'}
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex w-full flex-col items-start  justify-center gap-2">
                        <label className="text-h7 font-bold text-gray-2">Recents</label>
                        {[0, 1, 2].map((idx) => (
                            <div
                                key={idx}
                                className="flex h-10 w-full flex-row items-center justify-between border border-n-1 p-2 transition-colors hover:bg-n-3/10"
                            >
                                <div className="flex max-w-full flex-row items-center justify-center gap-2 overflow-hidden text-h7">
                                    <div className="h-6 w-6 animate-colorPulse rounded-full bg-slate-700" />

                                    <div className="h-6 w-24 animate-colorPulse rounded-full bg-slate-700" />
                                </div>
                            </div>
                        ))}
                    </div>
                ))
            )}
            {errorState.showError && (
                <>
                    <div className="w-full text-center">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                    {errorState.errorMessage.includes('We currently dont support ') && (
                        <a
                            href={'https://discord.gg/BX9Ak7AW28'}
                            target={'_blank'}
                            className="btn h-8 w-full cursor-pointer px-2"
                        >
                            Reach out!
                        </a>
                    )}
                </>
            )}
        </div>
    )
}
