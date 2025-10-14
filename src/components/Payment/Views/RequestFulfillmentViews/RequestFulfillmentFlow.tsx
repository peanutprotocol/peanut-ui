'use client'

import { Button } from '@/components/0_Bruddle'
import NavHeader from '@/components/Global/NavHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import UserCard from '@/components/User/UserCard'
import React, { useState } from 'react'

const RequestFulfillmentFlow = () => {
    const [inputTokenAmount, setInputTokenAmount] = useState<string>('')
    const [inputUsdValue, setInputUsdValue] = useState<string>('')
    const [currencyAmount, setCurrencyAmount] = useState<string>('')
    const requestAmount = 6969
    const amountCollected = 3479

    return (
        <div className="flex min-h-[inherit] w-full flex-col gap-y-6">
            <NavHeader onPrev={() => {}} title="Pay" />

            <div className="flex w-full flex-1 items-center justify-center">
                <div className="flex w-full flex-col gap-y-4">
                    <UserCard
                        type="request_pay"
                        username={'Zishan'}
                        fullName={'Zishan Mohd'}
                        recipientType={'USERNAME'}
                        size="small"
                        message={''}
                        fileUrl={''}
                        isVerified={true}
                        haveSentMoneyToUser={false}
                        amount={requestAmount}
                        amountCollected={amountCollected}
                    />

                    <TokenAmountInput
                        tokenValue={inputTokenAmount}
                        setTokenValue={(value: string | undefined) => setInputTokenAmount(value || '')}
                        setUsdValue={(value: string) => {
                            setInputUsdValue(value)
                        }}
                        setCurrencyAmount={(value) => setCurrencyAmount(value ?? '')}
                        className="w-full"
                        walletBalance={'10'}
                        currency={{ code: 'USD', symbol: '$', price: 1 }}
                        hideCurrencyToggle={true}
                        hideBalance={false}
                        showSlider={true}
                        maxAmount={requestAmount}
                    />

                    <Button
                        disabled={currencyAmount.length === 0 || parseFloat(currencyAmount) <= 0}
                        variant="purple"
                        className="w-full"
                        shadowSize="4"
                    >
                        Pay
                    </Button>
                    <h2 className="text-base font-bold text-black">Contributors (0)</h2>
                </div>
            </div>
        </div>
    )
}

export default RequestFulfillmentFlow
