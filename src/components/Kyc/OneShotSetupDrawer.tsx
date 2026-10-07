'use client'

import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import Badge, { type StatusType } from '@/components/Global/Badges/Badge'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { residenceCopyVariant } from '@/components/Kyc/unlock-checklist.utils'
import { CorridorFlag } from '@/features/deposit-accounts/components/CorridorFlag'
import type { KycIntentKey } from '@/services/kyc-intents'
import { localizedCountryName } from '@/utils/country-name.utils'
import type { SetupRow, SetupRowState, SetupRowStep } from '@/utils/one-shot-setup.utils'

interface OneShotSetupDrawerProps {
    open: boolean
    /** ISO-2 declared residence: names the local bank transfers and draws their flag. */
    residence: string
    rows: SetupRow[]
    /** The identity check wants one photo again: the header says so and the button reopens the check. */
    retake?: boolean
    /** A card request failed; the callout shows it with a retry. */
    cardError?: string | null
    onClose: () => void
    /** Every feature is available: the flow completes. */
    onContinue: () => void
    onRetake?: () => void
    /** "Verify again with a {country} ID": the identity restart. */
    onVerifyAgain?: () => void
    /** "Upload now" on a document a provider asks for. */
    onUploadDocument?: (step: SetupRowStep) => void
    /** "Continue card setup": the card questions or the agreements. */
    onResumeCard?: () => void
    onRetryCard?: () => void
    onContactSupport?: () => void
}

type BadgeLabel =
    | 'settingUp'
    | 'available'
    | 'underReview'
    | 'documentNeeded'
    | 'agreementsNeeded'
    | 'verifyId'
    | 'notAvailable'

// design.md badges: processing is in progress on our side, pending waits on
// someone, completed is done, neutral is a fact the user cannot change here.
// "Verify ID" is the status word for a feature blocked only by the user's own
// ID check; "Under review" covers a person checking the card application too,
// its row says the rest.
const STATE_BADGE: Record<SetupRowState, { status: StatusType; label: BadgeLabel }> = {
    'setting-up': { status: 'processing', label: 'settingUp' },
    'under-review': { status: 'pending', label: 'underReview' },
    available: { status: 'completed', label: 'available' },
    'document-needed': { status: 'pending', label: 'documentNeeded' },
    'agreements-needed': { status: 'pending', label: 'agreementsNeeded' },
    'needs-local-id': { status: 'pending', label: 'verifyId' },
    checking: { status: 'pending', label: 'underReview' },
    'occupation-not-accepted': { status: 'neutral', label: 'notAvailable' },
    'not-available': { status: 'neutral', label: 'notAvailable' },
}

type PrimaryStep =
    | { kind: 'retake' }
    | { kind: 'card' }
    | { kind: 'local-id' }
    | { kind: 'document'; step: SetupRowStep }
    | { kind: 'support' }

/**
 * One step at a time: the drawer offers the first thing the user can do, in
 * the order that gets them furthest. A photo to retake blocks everything; the
 * card step is already open; a new ID check reopens the most; a document
 * unblocks one provider; support is the way out of a refused occupation.
 */
function primaryStep(rows: SetupRow[], retake: boolean): PrimaryStep | null {
    if (retake) return { kind: 'retake' }
    if (rows.some((row) => row.state === 'agreements-needed')) return { kind: 'card' }
    if (rows.some((row) => row.state === 'needs-local-id')) return { kind: 'local-id' }
    const document = rows.find((row) => row.state === 'document-needed' && row.step)
    if (document?.step) return { kind: 'document', step: document.step }
    if (rows.some((row) => row.state === 'occupation-not-accepted')) return { kind: 'support' }
    return null
}

/**
 * The setup status after a one-shot SDK session (TASK-23329, items 9a and
 * 9b): one row per feature the user ticked, named as on the unlock checklist,
 * with the state its rails and the card step give it, and one button for the
 * first step the user can take. It stands in for the progress modal and its
 * Bridge terms phase.
 */
export const OneShotSetupDrawer = ({
    open,
    residence,
    rows,
    retake = false,
    cardError,
    onClose,
    onContinue,
    onRetake,
    onVerifyAgain,
    onUploadDocument,
    onResumeCard,
    onRetryCard,
    onContactSupport,
}: OneShotSetupDrawerProps) => {
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')
    const tIdentity = useTranslations('identity')
    const locale = useLocale()
    const router = useRouter()
    const variant = residenceCopyVariant(residence)
    const country = localizedCountryName(locale, residence, residence)
    const done = rows.length > 0 && rows.every((row) => row.state === 'available')
    const step = done ? null : primaryStep(rows, retake)

    // the titles and leading slots of UnlockChecklistStep's rows
    const rowTitle = (key: KycIntentKey) =>
        key === 'local' ? t(`unlock.rows.local.${variant}`) : t(`unlock.rows.${key}`)
    const rowLeading = (key: KycIntentKey) => {
        if (key === 'local') return <CorridorFlag iso2={residence} />
        const concept = key === 'qr' ? 'qrPay' : key === 'card' ? 'card' : 'bank'
        return <IconBubble {...CONCEPT_ICONS[concept]} size="s" />
    }
    // the states whose badge does not say enough get one line under the title
    const rowBody = (state: SetupRowState) => {
        switch (state) {
            case 'needs-local-id':
                // the capability reason's own line, so the drawer and the gate say the same thing
                return tIdentity('reasons.document_country_unsupported', { country })
            case 'checking':
                return t('setup.checking')
            case 'occupation-not-accepted':
                return t('setup.occupationNotAccepted')
            default:
                return undefined
        }
    }
    // the progress modal's way out while something is still pending
    const leave = () => {
        onClose()
        router.push('/home')
    }

    const primary = (() => {
        switch (step?.kind) {
            case 'retake':
                return { label: t('setup.retake'), onClick: onRetake }
            case 'card':
                return { label: t('setup.continueCard'), onClick: onResumeCard }
            case 'local-id':
                return {
                    label: t('setup.verifyAgain', { country }),
                    onClick: onVerifyAgain,
                    note: t('setup.verifyAgainNote'),
                }
            case 'document':
                return { label: t('setup.uploadNow'), onClick: () => onUploadDocument?.(step.step) }
            case 'support':
                return { label: tCommon('contactSupport'), onClick: onContactSupport }
            default:
                return null
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
                <div className="flex flex-col gap-6 pt-1 pb-6" data-testid="one-shot-setup">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <IconBubble icon={done ? 'check' : 'clock'} color={done ? 'green' : 'yellow'} />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>
                                {done
                                    ? t('progress.completeTitle')
                                    : retake
                                      ? t('setup.retakeTitle')
                                      : t('setup.settingUp')}
                            </DrawerTitle>
                        </DrawerHeader>
                    </div>
                    <ListGroup className="flex flex-col">
                        {rows.map(({ key, state }) => (
                            <ListItem
                                key={key}
                                leading={rowLeading(key)}
                                title={rowTitle(key)}
                                body={rowBody(state)}
                                bodyWrap
                                data-testid={`setup-row-${key}`}
                                trailing={
                                    <Badge
                                        status={STATE_BADGE[state].status}
                                        customText={t(`setup.${STATE_BADGE[state].label}`)}
                                    />
                                }
                            />
                        ))}
                    </ListGroup>
                    {cardError && (
                        <Callout
                            priority="error"
                            ctas={onRetryCard ? [{ label: tCommon('tryAgain'), onClick: onRetryCard }] : undefined}
                        >
                            {cardError}
                        </Callout>
                    )}
                    {primary?.note && (
                        <p className="text-center text-body-s text-foreground-secondary">{primary.note}</p>
                    )}
                    <div className="flex flex-col items-center gap-3">
                        {primary ? (
                            <>
                                <Button variant="primary" shadowSize="4" className="w-full" onClick={primary.onClick}>
                                    {primary.label}
                                </Button>
                                <LinkButton onClick={leave}>
                                    {step?.kind === 'document' ? t('setup.later') : tCommon('goToHome')}
                                </LinkButton>
                            </>
                        ) : (
                            <Button
                                variant="primary"
                                shadowSize="4"
                                className="w-full"
                                onClick={done ? onContinue : leave}
                            >
                                {tCommon(done ? 'continue' : 'goToHome')}
                            </Button>
                        )}
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
