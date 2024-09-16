'use client'

import { useContext, useEffect, useState } from 'react'
import validator from 'validator'
import { useSearchParams } from 'next/navigation'

import * as _consts from '../Create.consts'
import * as _utils from '../Create.utils'
import * as utils from '@/utils'
import * as context from '@/context'
import RecipientInput from '@/components/Global/RecipientInput'
import Icon from '@/components/Global/Icon'
import { ethers } from 'ethers'
import Loading from '@/components/Global/Loading'
import { validate } from 'multicoin-address-validator'
import { useAccount } from 'wagmi'
import { CrispButton } from '@/components/CrispChat'

export const CreateLinkInitialView = ({
    onNext,
    setCreateType,
    setRecipient,
    recentRecipients,
}: _consts.ICreateScreenProps) => {
    const searchParams = useSearchParams()
    const initialRecipientAddress = searchParams.get('recipientAddress') || ''
    const [inputValue, setInputValue] = useState(initialRecipientAddress)
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
        }
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

    useEffect(() => {
        if (initialRecipientAddress) {
            handleOnNext(initialRecipientAddress)
        }
    }, [])

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            <div className="space-y-2">
                <h2 className="text-h2">Send crypto</h2>
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

                <div className="max-w-96 text-center">
                    Transfer tokens via link or to an email, phone number, ENS, or wallet address.
                </div>
            </div>

            <div className="flex w-full  flex-col items-center justify-center gap-2">
                <button
                    onClick={() => {
                        setCreateType('link')
                        onNext()
                    }}
                    className="h-12- btn btn-purple w-full px-2 text-lg "
                >
                    Send via link
                </button>
                <div className="font-medium">or</div>
                <RecipientInput
                    placeholder="Email / Phone / ENS / wallet address"
                    value={inputValue}
                    setValue={setInputValue}
                    onEnter={() => {
                        if (inputValue.length > 0) handleOnNext()
                    }}
                />
            </div>
            {inputValue.length > 0 && (
                <div className="flex w-full flex-col items-start  justify-center gap-2">
                    <label className="text-h7 font-bold text-n-2">Search results</label>
                    <div
                        className="border-rounded flex w-full cursor-pointer flex-row items-center justify-between p-2 transition-colors hover:bg-n-3/10"
                        onClick={() => {
                            handleOnNext()
                        }}
                    >
                        <div className="flex max-w-full flex-row items-center justify-center gap-2 overflow-hidden text-h7">
                            <div className="rounded-full border-2 border-n-1">
                                <Icon name="profile" className="h-6 w-6 p-1" />
                            </div>
                            <div className="truncate">{inputValue}</div>
                        </div>
                        {isLoading && <Loading />}
                    </div>
                </div>
            )}
            {errorState.showError && (
                <>
                    <div className="w-full text-center">
                        <label className="text-sm text-red ">{errorState.errorMessage}</label>
                    </div>
                    {errorState.errorMessage.includes('We currently dont support ') && (
                        <CrispButton className="btn h-8 w-full cursor-pointer px-2">Reach out!</CrispButton>
                    )}
                </>
            )}
        </div>
    )
}
