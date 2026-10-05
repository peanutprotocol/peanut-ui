'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { Checkbox } from '@/components/0_Bruddle/Checkbox'
import { useSetupFlowContext, type SetupFundingMethod } from '@/features/setup/SetupFlowContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import SetupFooter from '../components/SetupFooter'

const METHODS: SetupFundingMethod[] = ['bank', 'cash', 'crypto', 'peanut']

export default function FundingStep() {
    const t = useTranslations('setup')
    const id = useId()
    const { fundingMethods, setFundingMethods } = useSetupFlowContext()
    const { handleNext, isLoading } = useSetupFlow()
    return (
        <div className="flex w-full flex-1 flex-col gap-6">
            <h1 className="text-heading-s">{t('funding.title')}</h1>
            <div className="flex flex-1 flex-col justify-center gap-4">
                <Card className="divide-y divide-dashed divide-border-default px-4">
                    {METHODS.map((method) => (
                        <DataRow
                            key={method}
                            label={<label htmlFor={`${id}-${method}`}>{t(`funding.methods.${method}`)}</label>}
                            value={
                                <Checkbox
                                    id={`${id}-${method}`}
                                    value={fundingMethods.includes(method)}
                                    onChange={(event) =>
                                        setFundingMethods(
                                            event.target.checked
                                                ? [...fundingMethods, method]
                                                : fundingMethods.filter((selected) => selected !== method)
                                        )
                                    }
                                />
                            }
                        />
                    ))}
                </Card>
                <p className="text-center text-body-xs text-foreground-secondary">{t('choicesLater')}</p>
            </div>
            <SetupFooter
                actions={
                    <Button onClick={() => void handleNext()} loading={isLoading} disabled={isLoading} shadowSize="4">
                        {t('next')}
                    </Button>
                }
            />
        </div>
    )
}
