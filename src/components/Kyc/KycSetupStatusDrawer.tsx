'use client'

import { isBridgeProcessingSlow } from '@/utils/kyc-processing.utils'
import { buildContactSupportMessage } from '@/utils/contact-support.utils'
import { isIdRetake, kycActionCtaKey } from '@/utils/kyc-action-copy.utils'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import Badge, { type StatusType } from '@/components/Global/Badges/Badge'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useModalsContext } from '@/context/ModalsContext'
import { CorridorFlag } from '@/features/deposit-accounts/components/CorridorFlag'
import { localizedCountryName } from '@/utils/country-name.utils'
import { paperworkVerificationFeaturePath } from '@/features/paperwork-verification/paperworkVerificationEntry'
import {
    setupReasonKey,
    type KycFeatureKey,
    type SetupRow,
    type SetupRowState,
    type SetupRowStep,
} from '@/utils/kyc-setup-status.utils'

interface KycSetupStatusDrawerProps {
    open: boolean
    /** ISO-2 residence: draws the flag of the local bank transfers and names the country of a local ID. */
    residence: string | null
    rows: SetupRow[]
    /** A step could not start. */
    error?: string | null
    /** A step is starting. */
    busy?: boolean
    onClose: () => void
    /** Every feature is available: the flow completes. */
    onContinue: () => void
    /** "Add proof of address" or "Upload now": the step a provider asks for. */
    onUploadDocument?: (step: SetupRowStep) => void
    /** "Review terms": the bank terms step, which names and links the documents. */
    onReviewTerms?: () => void
    /** A new identity check with another document. */
    onVerifyAgain?: () => void
}

type BadgeLabel =
    | 'settingUp'
    | 'available'
    | 'underReview'
    | 'documentNeeded'
    | 'questionsNeeded'
    | 'termsNeeded'
    | 'agreementsNeeded'
    | 'verifyId'
    | 'notAvailable'

// design.md badges: processing is in progress on our side, pending waits on
// someone or asks the user to act, completed is done, neutral is a fact the
// user cannot change here.
const STATE_BADGE: Record<SetupRowState, { status: StatusType; label: BadgeLabel }> = {
    'setting-up': { status: 'processing', label: 'settingUp' },
    'under-review': { status: 'pending', label: 'underReview' },
    available: { status: 'completed', label: 'available' },
    'document-needed': { status: 'pending', label: 'documentNeeded' },
    'questions-needed': { status: 'pending', label: 'questionsNeeded' },
    'terms-needed': { status: 'pending', label: 'termsNeeded' },
    'agreements-needed': { status: 'pending', label: 'agreementsNeeded' },
    'needs-local-id': { status: 'pending', label: 'verifyId' },
    'verify-again': { status: 'pending', label: 'verifyId' },
    'not-available': { status: 'neutral', label: 'notAvailable' },
}

type PrimaryStep =
    | { kind: 'terms' }
    | { kind: 'questions'; feature: NonNullable<NonNullable<SetupRowStep['action']>['feature']> }
    | { kind: 'document'; step: SetupRowStep }
    | { kind: 'card' }
    | { kind: 'verify'; localId: boolean; card: boolean }
    | { kind: 'support' }

/**
 * One step at a time, the lightest first: the bank terms, then a new identity
 * check (a document asked of the old one would be moot), a document, the card
 * on its own page, and support as the last way out.
 */
function primaryStep(rows: SetupRow[]): PrimaryStep | null {
    if (rows.some((row) => row.state === 'terms-needed')) return { kind: 'terms' }
    const question = rows.find((row) => row.state === 'questions-needed')?.step?.action?.feature
    if (question) return { kind: 'questions', feature: question }
    if (rows.some((row) => row.state === 'verify-again')) return { kind: 'verify', localId: false, card: false }
    const document = rows.find((row) => row.state === 'document-needed' && row.step)
    if (document?.step) return { kind: 'document', step: document.step }
    if (rows.some((row) => row.state === 'agreements-needed')) return { kind: 'card' }
    const verify = rows.find((row) => row.state === 'needs-local-id' || row.state === 'verify-again')
    if (verify) {
        const local = verify.state === 'needs-local-id'
        return { kind: 'verify', localId: local && verify.key !== 'card', card: local && verify.key === 'card' }
    }
    if (rows.some((row) => row.state === 'not-available' && row.support)) return { kind: 'support' }
    return null
}

/**
 * The setup status after a verification-attempt identity check: one row per
 * saved feature, with the state its rails give it, and one button for the
 * first step the user can take. It stands in for the progress modal. Ported
 * from the one-shot setup drawer (#3581, with the states of #3599).
 */
export const KycSetupStatusDrawer = ({
    open,
    residence,
    rows,
    error,
    busy = false,
    onClose,
    onContinue,
    onUploadDocument,
    onReviewTerms,
    onVerifyAgain,
}: KycSetupStatusDrawerProps) => {
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')
    const tIdentity = useTranslations('identity')
    const tRejection = useTranslations('profile.regions.providerRejection')
    const locale = useLocale()
    const router = useRouter()
    const { setIsSupportModalOpen, openSupportWithMessage } = useModalsContext()
    const country = residence ? localizedCountryName(locale, residence, residence) : null
    const done = rows.length > 0 && rows.every((row) => row.state === 'available')
    const step = done ? null : primaryStep(rows)
    // Each row's state (and reason) as its own property, so a funnel can split by feature.
    const rowProperties = Object.fromEntries(
        rows.flatMap((row) => [
            [`state_${row.key}`, row.state],
            ...(row.reason ? [[`reason_${row.key}`, row.reason]] : []),
        ])
    )
    const statesKey = rows.map((row) => `${row.key}:${row.state}`).join(',')
    const track = (event: typeof ANALYTICS_EVENTS.KYC_SETUP_STATUS_ACTION, action: string) =>
        posthog.capture(event, { action, done, step: step?.kind ?? null, ...rowProperties })
    useEffect(() => {
        if (!open) return
        posthog.capture(ANALYTICS_EVENTS.KYC_SETUP_STATUS_VIEWED, { done, step: step?.kind ?? null, ...rowProperties })
        // A view per opening, and per change of a row's state while open.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, statesKey])

    const rowLeading = (key: KycFeatureKey) => {
        if (key === 'local' && residence) return <CorridorFlag iso2={residence} />
        const concept = key === 'qr' ? 'qrPay' : key === 'card' ? 'card' : 'bank'
        return <IconBubble {...CONCEPT_ICONS[concept]} size="s" />
    }
    // the states whose badge does not say enough get one line under the title
    const rowBody = ({ key: feature, state, reason, step: rowStep, pendingSince }: SetupRow) => {
        if (isBridgeProcessingSlow(reason, pendingSince)) return tIdentity('reasons.bridge_processing_slow')
        if (state === 'questions-needed') {
            const key = setupReasonKey(reason)
            return key ? tIdentity(key) : undefined
        }
        if (state === 'document-needed' || state === 'terms-needed') {
            const key = setupReasonKey(reason)
            if (key) return tIdentity(key)
            if (state === 'terms-needed') return t('setup.termsDescription')
            if (isIdRetake(rowStep?.action)) return t('initiate.descriptionRetakeId')
            const proofOfAddress =
                rowStep?.action?.key.startsWith('supplement:') || rowStep?.action?.levelKey === 'proof_of_address'
            return t(proofOfAddress ? 'setup.proofOfAddressDescription' : 'setup.documentDescription')
        }
        // The card's issuer never names the document, so neither do we.
        if (state === 'needs-local-id' && feature === 'card')
            return tIdentity('reasons.card_unavailable_for_verification')
        if (state === 'needs-local-id' && country) {
            return tIdentity('reasons.document_country_unsupported', { country })
        }
        if (state !== 'verify-again' && state !== 'not-available' && reason !== 'requirements_in_review') return
        const key = setupReasonKey(reason)
        return key ? tIdentity(key) : undefined
    }
    const leave = () => {
        track(ANALYTICS_EVENTS.KYC_SETUP_STATUS_ACTION, step?.kind === 'document' ? 'later' : 'home')
        onClose()
        router.push('/home')
    }
    const openCardPage = () => {
        onClose()
        router.push('/card')
    }

    const primary = (() => {
        switch (step?.kind) {
            case 'terms':
                return { label: t('setup.reviewTerms'), onClick: onReviewTerms }
            case 'questions':
                return {
                    label: t('initiate.ctaAnswerQuestion'),
                    onClick: () => {
                        onClose()
                        router.push(paperworkVerificationFeaturePath(step.feature))
                    },
                }
            case 'document':
                if (step.step.provider === 'rain') return { label: t('setup.continueCard'), onClick: openCardPage }
                return {
                    label: step.step.action?.key.startsWith('supplement:')
                        ? t('supplement.proofOfAddressCta')
                        : kycActionCtaKey(step.step.action, step.step.reasonCode) === 'initiate.ctaUploadDocument'
                          ? t('setup.uploadNow')
                          : t(kycActionCtaKey(step.step.action, step.step.reasonCode)),
                    onClick: () => onUploadDocument?.(step.step),
                }
            case 'card':
                return { label: t('setup.continueCard'), onClick: openCardPage }
            case 'verify':
                return {
                    label: step.card
                        ? t('setup.verifyAgainPlain')
                        : step.localId && country
                          ? t('setup.verifyAgain', { country })
                          : tRejection('restartTitle'),
                    onClick: onVerifyAgain,
                    note: t('setup.verifyAgainNote'),
                }
            case 'support':
                return {
                    label: tCommon('contactSupport'),
                    onClick: () => {
                        onClose()
                        setIsSupportModalOpen(true)
                    },
                }
            default: {
                const slowRow = rows.find((row) => isBridgeProcessingSlow(row.reason, row.pendingSince))
                return slowRow
                    ? {
                          label: tCommon('contactSupport'),
                          onClick: () => {
                              onClose()
                              openSupportWithMessage(
                                  buildContactSupportMessage({
                                      reason: {
                                          code: 'bridge_processing',
                                          userMessage: tIdentity('reasons.bridge_processing_slow'),
                                      },
                                      railId: slowRow.railId,
                                  })
                              )
                          },
                      }
                    : null
            }
        }
    })()

    return (
        <Drawer
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col gap-6 pt-1 pb-6" data-testid="kyc-setup-status">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <IconBubble icon={done ? 'check' : 'clock'} color={done ? 'green' : 'yellow'} />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{done ? t('progress.completeTitle') : t('setup.settingUp')}</DrawerTitle>
                        </DrawerHeader>
                    </div>
                    <ListGroup className="flex flex-col">
                        {rows.map((row) => (
                            <ListItem
                                key={row.key}
                                leading={rowLeading(row.key)}
                                title={t(`documents.${row.key}`)}
                                body={rowBody(row)}
                                bodyWrap
                                data-testid={`setup-row-${row.key}`}
                                trailing={
                                    <Badge
                                        status={STATE_BADGE[row.state].status}
                                        customText={t(`setup.${STATE_BADGE[row.state].label}`)}
                                    />
                                }
                            />
                        ))}
                    </ListGroup>
                    {error && <Callout priority="error">{error}</Callout>}
                    {primary?.note && (
                        <p className="text-center text-body-s text-foreground-secondary">{primary.note}</p>
                    )}
                    {primary ? (
                        <div className="flex flex-col items-center gap-6">
                            <Button
                                variant="primary"
                                shadowSize="4"
                                className="w-full"
                                disabled={busy}
                                onClick={() => {
                                    track(ANALYTICS_EVENTS.KYC_SETUP_STATUS_ACTION, step?.kind ?? 'none')
                                    primary.onClick?.()
                                }}
                                data-testid="kyc-setup-step"
                            >
                                {primary.label}
                            </Button>
                            <LinkButton onClick={leave} disabled={busy}>
                                {step?.kind === 'document' ? t('setup.later') : tCommon('goToHome')}
                            </LinkButton>
                        </div>
                    ) : (
                        <Button
                            variant="primary"
                            shadowSize="4"
                            className="w-full"
                            onClick={
                                done
                                    ? () => {
                                          track(ANALYTICS_EVENTS.KYC_SETUP_STATUS_ACTION, 'continue')
                                          onContinue()
                                      }
                                    : leave
                            }
                        >
                            {tCommon(done ? 'continue' : 'goToHome')}
                        </Button>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    )
}
