'use client'

import { useEffect, useId } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { Checkbox } from '@/components/0_Bruddle/Checkbox'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { useSetupFlowContext, type SetupFundingMethod } from '@/features/setup/SetupFlowContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useResidenceRestrictionSetsWithStatus } from '@/hooks/useResidenceRestrictionSets'
import { availableSetupFeaturesForResidence } from '@/features/setup/availableFeaturesForResidence'
import SetupFooter from '../components/SetupFooter'

const METHODS: SetupFundingMethod[] = ['bank', 'cash', 'crypto', 'peanut']
const UNIVERSAL_METHODS: SetupFundingMethod[] = ['crypto', 'peanut']
const METHOD_ICONS: Record<SetupFundingMethod, IconName> = {
    bank: 'bank',
    cash: 'currency',
    crypto: 'coins',
    peanut: 'users',
}

export default function FundingStep() {
    const t = useTranslations('setup')
    const id = useId()
    const { residenceCountry, fundingMethods, setFundingMethods } = useSetupFlowContext()
    const { sets, settled } = useResidenceRestrictionSetsWithStatus()
    const { bank, card } = availableSetupFeaturesForResidence(sets, residenceCountry, settled)
    const methods = bank || card ? METHODS : UNIVERSAL_METHODS
    const selectedMethods = fundingMethods.filter((method) => methods.includes(method))
    // Changing residence must also remove previously selected hidden options.
    useEffect(() => {
        if (fundingMethods.some((method) => !methods.includes(method))) {
            setFundingMethods(fundingMethods.filter((method) => methods.includes(method)))
        }
    }, [fundingMethods, methods, setFundingMethods])
    const { handleNext, isLoading } = useSetupFlow()
    return (
        <div className="flex w-full flex-1 flex-col gap-6">
            <h1 className="text-heading-s">{t('funding.title')}</h1>
            <div className="flex flex-1 flex-col justify-center gap-4">
                <Card className="divide-y divide-dashed divide-border-default px-4">
                    {methods.map((method) => (
                        <DataRow
                            compact
                            key={method}
                            wrapLabel
                            label={
                                <label
                                    htmlFor={`${id}-${method}`}
                                    className="flex items-center gap-3 text-foreground-primary"
                                >
                                    <Icon name={METHOD_ICONS[method]} size={24} className="shrink-0" />
                                    <span>{t(`funding.methods.${method}`)}</span>
                                </label>
                            }
                            value={
                                <Checkbox
                                    id={`${id}-${method}`}
                                    value={selectedMethods.includes(method)}
                                    onChange={(event) =>
                                        setFundingMethods(
                                            event.target.checked
                                                ? [...selectedMethods, method]
                                                : selectedMethods.filter((selected) => selected !== method)
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
                        {t('cta.funding')}
                    </Button>
                }
            />
        </div>
    )
}
