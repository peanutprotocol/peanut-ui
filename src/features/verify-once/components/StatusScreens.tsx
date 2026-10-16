'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import SetupTitleBlock from '@/components/Setup/components/SetupTitleBlock'
import type { VerifyOnceFeature } from '@/app/actions/types/kyc-verify-once.types'
import { VerifyFooter, VerifyHeroLayout, VerifyQuestionLayout } from './VerifyLayout'

const primary = (label: string, onClick: () => void, testId: string, loading = false) => (
    <Button
        shadowSize="4"
        className="w-full"
        onClick={onClick}
        loading={loading}
        disabled={loading}
        data-testid={testId}
    >
        {label}
    </Button>
)

/** After the selfie: the review is running. A failed review sends the user to Home, where its fix lives. */
export function ReviewScreen({ failed, onHome }: { failed: boolean; onHome: () => void }) {
    const t = useTranslations('kyc.verifyOnce')
    const copy = failed ? 'failed' : 'review'
    return (
        <VerifyHeroLayout
            pose={failed ? 'sad' : 'thinking'}
            title={t(`${copy}.title`)}
            description={t(`${copy}.description`)}
            footer={<VerifyFooter actions={primary(t(`${copy}.cta`), onHome, 'verify-review-home')} />}
        />
    )
}

/** Approved: Home's next step is adding money. */
export function VerifiedScreen({ onHome }: { onHome: () => void }) {
    const t = useTranslations('kyc.verifyOnce')
    return (
        <VerifyHeroLayout
            pose="cheering"
            title={t('verified.title')}
            description={t('verified.description')}
            footer={<VerifyFooter actions={primary(t('verified.cta'), onHome, 'verify-verified-home')} />}
        />
    )
}

/** Add-later is saved: the providers take it from here, and the account rows show their status. */
export function FeatureReadyScreen({ feature, onDone }: { feature: VerifyOnceFeature; onDone: () => void }) {
    const t = useTranslations('kyc.verifyOnce')
    return (
        <VerifyHeroLayout
            pose="too-cool"
            title={t('addLater.doneTitle')}
            description={t(`addLater.doneDescription.${feature}`)}
            footer={<VerifyFooter actions={primary(t('addLater.doneCta'), onDone, 'verify-feature-done')} />}
        />
    )
}

const PROOF_KINDS = [
    { key: 'bankStatement', icon: 'docs' },
    { key: 'utilityBill', icon: 'bulb' },
    { key: 'taxLetter', icon: 'bank' },
] as const

/**
 * Rule 1: the ID is from another country than the residence and a bank
 * account was picked, so Bridge will want a proof of address. Suggested, never
 * required: Skip leaves no task behind and the bank account still opens.
 */
export function ProofOfAddressScreen({
    residenceName,
    uploading,
    error,
    onUpload,
    onSkip,
}: {
    residenceName: string
    uploading: boolean
    error: string | null
    onUpload: () => void
    onSkip: () => void
}) {
    const t = useTranslations('kyc.verifyOnce')
    return (
        <VerifyQuestionLayout
            footer={
                <VerifyFooter
                    actions={primary(t('poa.upload'), onUpload, 'verify-poa-upload', uploading)}
                    secondary={
                        <LinkButton onClick={onSkip} disabled={uploading} data-testid="verify-poa-skip">
                            {t('poa.skip')}
                        </LinkButton>
                    }
                >
                    {error && (
                        <Callout priority="error" className="w-full text-left">
                            {error}
                        </Callout>
                    )}
                </VerifyFooter>
            }
        >
            <SetupTitleBlock
                title={t('poa.title')}
                description={t('poa.description', { country: residenceName })}
                size="m"
            />
            <ListGroup>
                {PROOF_KINDS.map(({ key, icon }) => (
                    <ListItem
                        key={key}
                        title={t(`poa.kinds.${key}`)}
                        body={t('poa.recent')}
                        leading={<IconBubble icon={icon} size="s" color="blue" />}
                    />
                ))}
            </ListGroup>
            <p className="text-body-s text-foreground-secondary">{t('poa.skipNote')}</p>
        </VerifyQuestionLayout>
    )
}
