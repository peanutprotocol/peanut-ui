'use client'

import { useSearchParams } from 'next/navigation'
import { useContext, useEffect, useState } from 'react'
import validator from 'validator'

import { Button, Card } from '@/components/0_Bruddle'
import Divider from '@/components/0_Bruddle/Divider'
import { CrispButton } from '@/components/CrispChat'
import Icon from '@/components/Global/Icon'
import Loading from '@/components/Global/Loading'
import RecipientInput from '@/components/Global/RecipientInput'
import * as context from '@/context'
import * as utils from '@/utils'
import { ethers } from 'ethers'
import { validate } from 'multicoin-address-validator'
import * as _consts from '../Create.consts'

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
        <Card className="shadow-none sm:shadow-primary-4">
            <Card.Header>
                <Card.Title>Send crypto</Card.Title>
                <Card.Description>
                    Transfer tokens via link or to an email, phone number, ENS, or wallet address.
                </Card.Description>
            </Card.Header>
            <Card.Content>
                <div className="flex w-full  flex-col items-center justify-center gap-2">
                    <Button
                        onClick={() => {
                            setCreateType('link')
                            onNext()
                        }}
                    >
                        Send via link
                    </Button>
                    <Divider text="or" />
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
                )}
                {errorState.showError && (
                    <>
                        <div className="w-full text-start">
                            <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                        </div>
                        {errorState.errorMessage.includes('We currently dont support ') && (
                            <CrispButton className="btn h-8 w-full cursor-pointer px-2">Reach out!</CrispButton>
                        )}
                    </>
                )}
            </Card.Content>
        </Card>
    )
}
