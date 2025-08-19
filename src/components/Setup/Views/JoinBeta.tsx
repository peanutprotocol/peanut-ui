import { Button } from '@/components/0_Bruddle'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useAppDispatch, useSetupStore } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import React, { useState } from 'react'

const JoinBeta = () => {
    const { handleNext } = useSetupFlow()
    const dispatch = useAppDispatch()
    const { telegramHandle: savedTgHandle } = useSetupStore()
    const [telegramHandle, setTelegramHandle] = useState(savedTgHandle)
    const [isError, setIsError] = useState(false)

    const validateUsername = (username: string) => {
        // Regex based on Telegram rules
        const regex = /^(?!\d)[a-zA-Z0-9_]{5,32}$/
        const res = regex.test(username)
        if (!res) {
            setIsError(true)
        }
        return res
    }

    return (
        <>
            <div className="flex h-full flex-col justify-between gap-11 md:pt-5">
                <div className="mb-auto w-full space-y-6">
                    <BaseInput
                        value={telegramHandle}
                        onChange={(e) => setTelegramHandle(e.target.value)}
                        placeholder="Telegram handle"
                        className="h-12"
                    />

                    <Button
                        className="h-12"
                        shadowSize="4"
                        onClick={() => {
                            if (validateUsername(telegramHandle)) {
                                dispatch(setupActions.setTelegramHandle(telegramHandle))
                                handleNext()
                            }
                        }}
                    >
                        Join beta program
                    </Button>
                    <p
                        onClick={() => {
                            dispatch(setupActions.setTelegramHandle(''))
                            handleNext()
                        }}
                        className="cursor-pointer text-center text-sm underline"
                    >
                        No thanks!
                    </p>

                    {isError && (
                        <div className="pb-1">
                            <ErrorAlert description={'Invalid Username'} className="gap-2 text-xs" iconSize={14} />
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

export default JoinBeta
