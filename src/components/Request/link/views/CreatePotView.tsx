'use client'

import { useTranslations } from 'next-intl'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import AmountInput from '@/components/Global/AmountInput'
import NavHeader from '@/components/Global/NavHeader'
import { useRequestBack } from '@/components/Request/useRequestBack'
import { RequestCreatedView } from './RequestCreatedView'
import { useCreateRequestLink } from './useCreateRequestLink'

/** A crowdfunding pot is an ordinary request link with a voluntary USD goal. */
export function CreatePotView() {
    const t = useTranslations('pots')
    const onBack = useRequestBack()
    const {
        requestAmount,
        attachmentOptions,
        errorState,
        requestId,
        generatedLink,
        isCreatingLink,
        handleRequestAmountChange,
        handleAttachmentOptionsChange,
        generateLink,
    } = useCreateRequestLink({ isCrowdfunding: true })
    const validGoal =
        requestAmount === '' ||
        (/^\d+(\.\d{1,2})?$/.test(requestAmount) && Number.isFinite(Number(requestAmount)) && Number(requestAmount) > 0)

    if (requestId && generatedLink) {
        return (
            <RequestCreatedView
                requestId={requestId}
                generatedLink={generatedLink}
                requestAmount={requestAmount}
                currency="USD"
                bankPayable={false}
                isCrowdfunding
                onDone={onBack}
            />
        )
    }

    return (
        <PageStack>
            <NavHeader onPrev={onBack} title={t('title')} />
            <PageStack.Center className="gap-4">
                <TitleBlock size="s" title={<h1>{t('introTitle')}</h1>} />
                <label htmlFor="pot-purpose" className="text-body-s">
                    {t('purpose')}
                </label>
                <BaseInput
                    id="pot-purpose"
                    value={attachmentOptions.message}
                    maxLength={140}
                    placeholder={t('purposePlaceholder')}
                    disabled={isCreatingLink}
                    required
                    onChange={(event) =>
                        handleAttachmentOptionsChange({ ...attachmentOptions, message: event.target.value })
                    }
                />
                <p className="text-body-s">{t('goal')}</p>
                <AmountInput
                    initialAmount={requestAmount}
                    setPrimaryAmount={handleRequestAmountChange}
                    hideBalance
                    hideCurrencyToggle
                    disabled={isCreatingLink}
                />
                <p className="text-body-s text-foreground-secondary">{t('noGoalHint')}</p>
                <p className="text-body-s text-foreground-secondary">{t('directFunding')}</p>
                <Button
                    onClick={generateLink}
                    loading={isCreatingLink}
                    disabled={isCreatingLink || !attachmentOptions.message?.trim() || !validGoal}
                >
                    {t('create')}
                </Button>
                {errorState.showError && <Callout priority="error">{errorState.errorMessage}</Callout>}
            </PageStack.Center>
        </PageStack>
    )
}
