'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { Checkbox } from '@/components/0_Bruddle/Checkbox'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { useSetupFlowContext, type SetupFundingMethod } from '@/features/setup/SetupFlowContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import SetupFooter from '../components/SetupFooter'

const METHODS: SetupFundingMethod[] = ['bank', 'cash', 'crypto', 'peanut']
const METHOD_ICONS: Record<SetupFundingMethod, IconName> = {
    bank: 'bank',
    cash: 'currency',
    crypto: 'coins',
    peanut: 'users',
}

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
                            spacious
                            key={method}
                            wrapLabel
                            label={
                                <label htmlFor={`${id}-${method}`} className="flex items-center gap-3">
                                    <Icon name={METHOD_ICONS[method]} size={24} className="shrink-0" />
                                    <span>{t(`funding.methods.${method}`)}</span>
                                </label>
                            }
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
                <p className="flex items-center justify-center gap-2 text-center text-body-xs text-foreground-secondary">
                    <Icon name="info" size={16} className="shrink-0" />
                    {t('choicesLater')}
                </p>
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
