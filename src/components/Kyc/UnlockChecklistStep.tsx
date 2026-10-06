'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useId, useMemo, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { CountryCombobox } from '@/components/Common/CountryCombobox'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { Drawer, DrawerContent } from '@/components/Global/Drawer'
import { Icon } from '@/components/Global/Icons/Icon'
import KycPrepChecklist, { type KycPrepPath } from '@/components/Kyc/KycPrepChecklist'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import { CorridorFlag } from '@/features/deposit-accounts/components/CorridorFlag'
import { KYC_INTENT_KEYS, type KycIntentKey } from '@/services/kyc-intents'
import { localizedCountryName } from '@/utils/country-name.utils'
import { buildResidenceCountryOptions } from '@/utils/residence-options'
import { twMerge } from '@/utils/tw'
import { residenceCopyVariant } from './unlock-checklist.utils'
import { type IdDocumentAnswer, useUnlockChecklist } from './useUnlockChecklist'

interface UnlockChecklistStepProps {
    /** ISO-2 declared residence the rows are built for. */
    residence: string
    /** Which InitiateKycModal form hosts the step: the explore-first sheet nests inside the drawer form. */
    host: 'page' | 'drawer'
    prepPath: KycPrepPath
    taxIdCountry?: 'AR' | 'BR'
    /** The SDK start is in flight. */
    isLoading: boolean
    /** Opens the SDK once the ticked set is stored. */
    onVerify: () => void
    /** "Explore first": leaves the screen without verifying. */
    onExplore: () => void
    /** Tells the host a save is in flight, so the drawer form cannot be dismissed under it. */
    onSavingChange: (saving: boolean) => void
}

const SKELETON = 'animate-pulse rounded bg-foreground-primary/10'

/**
 * The one-shot unlock checklist (TASK-23329): what the declared residence can
 * unlock, narrowed by the ID the user will show, every open row ticked. The
 * answer re-queries GET /config/kyc-intents, so a document a provider refuses
 * closes its rows before the first photo. Continue stores the ticked set and
 * opens the SDK; "Not now" offers exploring first. Rendered by
 * InitiateKycModal's page form in place of the plain unlock offer.
 */
export const UnlockChecklistStep = ({
    residence,
    host,
    prepPath,
    taxIdCountry,
    isLoading,
    onVerify,
    onExplore,
    onSavingChange,
}: UnlockChecklistStepProps) => {
    const t = useTranslations('kyc.unlock')
    const tKyc = useTranslations('kyc')
    const tCommon = useTranslations('common')
    const tIdentity = useTranslations('identity')
    const locale = useLocale()
    const questionId = useId()
    const country = localizedCountryName(locale, residence, residence)
    const variant = residenceCopyVariant(residence)
    const countryOptions = useMemo(() => buildResidenceCountryOptions(locale), [locale])
    const checklist = useUnlockChecklist(residence, onVerify)
    const [exploreOpen, setExploreOpen] = useState(false)
    const saving = checklist.save.isPending
    useEffect(() => {
        onSavingChange(saving)
        return () => onSavingChange(false)
    }, [saving, onSavingChange])
    const busy = isLoading || saving

    const answers: Array<{ id: IdDocumentAnswer; label: string }> = [
        { id: 'local', label: t(`idLocal.${variant}`, { country }) },
        { id: 'foreign', label: t('idForeign') },
    ]

    const rowTitle = (key: KycIntentKey) =>
        key === 'local' ? t(`rows.local.${variant}`) : key === 'qr' ? t('rows.qr') : t(`rows.${key}`)
    // flags replace the bubble on a bank row (AccountsHubList); the other concepts take their fixed pair
    const rowLeading = (key: KycIntentKey) => {
        if (key === 'local') return <CorridorFlag iso2={residence} />
        const concept = key === 'qr' ? 'qrPay' : key === 'card' ? 'card' : 'bank'
        return <IconBubble {...CONCEPT_ICONS[concept]} size="s" />
    }
    const rowBody = (key: KycIntentKey, reason?: string) => {
        if (reason) {
            const reasonKey = reasonCodeKey(reason)
            return reasonKey ? tIdentity(reasonKey, { country }) : undefined
        }
        return key === 'qr' ? t(`rows.qrMethods.${variant}`) : undefined
    }

    return (
        <>
            <h1 className="text-heading-xs text-foreground-primary">{t('title', { country })}</h1>
            <div className="flex flex-col gap-2">
                <p id={questionId} className="text-label-l">
                    {t('idQuestion')}
                </p>
                {/* selected = fill + check, as the token rows (design.md "selected list
                    rows"); the radio semantics ride a wrapper because ListItem forwards no
                    role, the same hold as TokenListItem */}
                <div role="radiogroup" aria-labelledby={questionId} className="flex flex-col">
                    {answers.map((answer, index) => {
                        const selected = checklist.document === answer.id
                        const paint = selected ? 'text-foreground-over-color-primary' : undefined
                        const choose = () => checklist.setDocument(answer.id)
                        return (
                            <div
                                key={answer.id}
                                role="radio"
                                aria-checked={selected}
                                tabIndex={0}
                                onClick={choose}
                                onKeyDown={(event) => {
                                    if (event.key !== 'Enter' && event.key !== ' ') return
                                    event.preventDefault()
                                    choose()
                                }}
                                className="cursor-pointer focus-visible:outline-[3px] focus-visible:outline-action-focus"
                            >
                                <ListItem
                                    position={getCardPosition(index, answers.length)}
                                    className={twMerge(
                                        'transition-colors duration-instant',
                                        selected && 'bg-action-primary'
                                    )}
                                    title={<span className={paint}>{answer.label}</span>}
                                    trailing={selected ? <Icon name="check" size={20} className={paint} /> : undefined}
                                />
                            </div>
                        )
                    })}
                </div>
                {checklist.document === 'foreign' && (
                    <CountryCombobox
                        options={countryOptions}
                        placeholder={t('foreignIdCountryPlaceholder')}
                        aria-label={t('foreignIdCountryPlaceholder')}
                        value={checklist.foreignIdCountry}
                        onValueChange={checklist.setForeignIdCountry}
                    />
                )}
            </div>
            {checklist.isLoading ? (
                <ListGroup className="flex flex-col" aria-busy data-testid="unlock-rows-loading">
                    {KYC_INTENT_KEYS.map((key) => (
                        <ListItem
                            key={key}
                            leading={<div className={twMerge(SKELETON, 'size-8 rounded-full')} />}
                            title={<div className={twMerge(SKELETON, 'h-4 w-32')} />}
                        />
                    ))}
                </ListGroup>
            ) : checklist.isError ? (
                <Callout priority="error" title={t('loadFailed')}>
                    <LinkButton onClick={() => void checklist.refetch()}>{tCommon('tryAgain')}</LinkButton>
                </Callout>
            ) : (
                checklist.rows.length > 0 && (
                    <ListGroup className="flex flex-col">
                        {checklist.rows.map((row) => {
                            const title = rowTitle(row.key)
                            return (
                                <ListItem
                                    key={row.key}
                                    leading={rowLeading(row.key)}
                                    title={title}
                                    body={rowBody(row.key, row.reason)}
                                    bodyWrap
                                    data-testid={`unlock-row-${row.key}`}
                                    trailing={
                                        row.available ? (
                                            <Toggle
                                                checked={checklist.intents[row.key]}
                                                onChange={() => checklist.toggle(row.key)}
                                                aria-label={title}
                                            />
                                        ) : undefined
                                    }
                                />
                            )
                        })}
                    </ListGroup>
                )
            )}
            <p className="text-body-xs text-foreground-secondary">{t('note')}</p>
            {/* the prep list reads as the legacy body did: secondary Body/S around its own card */}
            <div className="text-body-s text-foreground-secondary">
                <KycPrepChecklist path={prepPath} taxIdCountry={taxIdCountry} />
            </div>
            {checklist.save.isError && <Callout priority="error">{t('saveFailed')}</Callout>}
            <Button
                variant="primary"
                shadowSize="4"
                className="h-11 w-full"
                disabled={busy || !checklist.canContinue}
                loading={busy}
                onClick={() => checklist.save.mutate(checklist.intents)}
            >
                {checklist.qrOnly ? t('ctaQrOnly') : t('cta')}
            </Button>
            <div className="flex justify-center">
                <LinkButton onClick={() => setExploreOpen(true)} disabled={busy}>
                    {t('notNow')}
                </LinkButton>
            </div>
            <PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />
            {/* the explore-first sheet: nested inside the drawer form, so it stacks above
                it (design.md "nested drawer confirm"); its own sheet on the page form */}
            <Drawer nested={host === 'drawer'} open={exploreOpen} onOpenChange={setExploreOpen}>
                <DrawerContent accessibleTitle={t('exploreTitle')} className="py-4">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <IconBubble {...CONCEPT_ICONS.verification} />
                        <TitleBlock align="center" title={t('exploreTitle')} description={t('exploreDescription')} />
                        <Button
                            variant="primary"
                            shadowSize="4"
                            className="w-full"
                            onClick={() => setExploreOpen(false)}
                        >
                            {tKyc('continueVerification')}
                        </Button>
                        {/* mt-2 on the gap-4 column: 24px above the tertiary */}
                        <div className="mt-2 flex justify-center">
                            <LinkButton
                                onClick={() => {
                                    checklist.skip()
                                    setExploreOpen(false)
                                    onExplore()
                                }}
                            >
                                {t('exploreFirst')}
                            </LinkButton>
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    )
}
