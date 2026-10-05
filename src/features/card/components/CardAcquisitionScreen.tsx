'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryState, parseAsStringEnum } from 'nuqs'
import { useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { Button } from '@/components/0_Bruddle/Button'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import NavHeader from '@/components/Global/NavHeader'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { HoldToClaimButton } from '@/components/Global/HoldToClaimButton'
import { ScaledPixelatedCardFace } from '@/components/Card/share-asset/ScaledPixelatedCardFace'
import AddCardEntryScreen from '@/components/Card/AddCardEntryScreen'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import type { ShakeIntensity } from '@/hooks/useHoldToClaim'
import { getShakeClass } from '@/utils/perk.utils'
import { readStoredValue, writeStoredValue } from '@/utils/safe-storage'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { withReturnTo } from '@/utils/return-to.utils'

const STEPS = ['eligibility', 'looking-up', 'available', 'funding', 'entry'] as const

export function CardMilestoneScreen({
    issued = false,
    funded = false,
    onContinue,
}: {
    issued?: boolean
    funded?: boolean
    onContinue: () => void
}) {
    const t = useTranslations('card.onboarding')
    const tCommon = useTranslations('common')
    const reducedMotion = useReducedMotion()
    const celebrated = useRef(false)
    useEffect(() => {
        if (celebrated.current) return
        celebrated.current = true
        if (!reducedMotion) shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.4 } })
    }, [reducedMotion])
    return (
        <PageStack>
            <NavHeader title={t('navTitle')} hideBackBtn />
            <PageStack.Center>
                {!issued && (
                    <div className="mx-auto w-full max-w-sm px-2 pb-2" aria-hidden>
                        <ScaledPixelatedCardFace last4="????" />
                    </div>
                )}
                <TitleBlock
                    title={<h1>{t(issued ? 'issuedTitle' : 'availableTitle')}</h1>}
                    description={<p>{t(issued ? 'issuedBody' : 'fundingBody')}</p>}
                    align={issued ? 'center' : 'start'}
                    size="s"
                />
            </PageStack.Center>
            <PageStack.Footer>
                <Button variant="primary" className="w-full" onClick={onContinue}>
                    {issued ? t('viewCard') : funded ? tCommon('continue') : t('addFunds')}
                </Button>
            </PageStack.Footer>
        </PageStack>
    )
}

/** Figma: Peanut WIP Slava / STEPS / 04 SPEND (19068:2985).
 * Presentation steps only. The live balance and provider state always own application access. */
export function CardAcquisitionScreen({
    userId,
    eligible,
    funded,
    fundingRequired,
    onApply,
    onPrev,
    applyError,
}: {
    userId: string
    eligible: boolean
    funded: boolean
    fundingRequired: boolean
    onApply: () => void | Promise<void>
    onPrev: () => void
    applyError?: string | null
}) {
    const t = useTranslations('card')
    const tAdd = useTranslations('addMoney')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const [step, setStep] = useQueryState('card_step', parseAsStringEnum([...STEPS]))
    const seenKey = `card_anticipation_completed_v1:${userId}`
    const [seen] = useState(() => readStoredValue(seenKey) === '1')
    const currentStep = step ?? (seen ? (funded ? 'entry' : 'funding') : 'eligibility')
    const [shake, setShake] = useState<{ on: boolean; intensity: ShakeIntensity }>({ on: false, intensity: 'none' })
    const [revealing, setRevealing] = useState(false)
    const reducedMotion = useReducedMotion()
    const { triggerHaptic } = useAppHaptic()

    useEffect(() => {
        if (currentStep !== 'looking-up') return
        const shakeTimer = setTimeout(
            () => {
                setRevealing(true)
                if (!reducedMotion) triggerHaptic()
            },
            reducedMotion ? 0 : 600
        )
        const revealTimer = setTimeout(
            () => void setStep('available', { history: 'replace' }),
            reducedMotion ? 0 : 1100
        )
        return () => {
            clearTimeout(shakeTimer)
            clearTimeout(revealTimer)
        }
    }, [currentStep, reducedMotion, triggerHaptic, setStep])

    // Unknown residence still goes through the existing verification path;
    // it must never receive the "You're in" eligibility promise.
    if (!eligible || (currentStep === 'entry' && !fundingRequired)) {
        return <AddCardEntryScreen onApply={onApply} onPrev={onPrev} applyError={applyError} />
    }

    if (fundingRequired || currentStep === 'funding') {
        return (
            <PageStack>
                <NavHeader title={t('onboarding.navTitle')} onPrev={onPrev} />
                <h1 className="text-heading-s text-foreground-primary">{tAdd('title')}</h1>
                <p className="text-body-m text-foreground-secondary">{t('onboarding.fundingBody')}</p>
                <ListGroup>
                    <ListItem
                        title={tAdd('methods.bankTransfer')}
                        body={tAdd('methods.bankTransferDescription')}
                        leading={<IconBubble {...CONCEPT_ICONS.bank} size="s" />}
                        chevron
                        onClick={() => router.push(withReturnTo('/add-money?method=bank', '/card?card_step=funding'))}
                    />
                    <ListItem
                        title={tAdd('methods.crypto')}
                        body={tAdd('methods.cryptoDescription')}
                        leading={<IconBubble {...CONCEPT_ICONS.crypto} size="s" />}
                        chevron
                        onClick={() => router.push(withReturnTo('/add-money/crypto', '/card?card_step=funding'))}
                    />
                </ListGroup>
                <PageStack.Footer>
                    <Button
                        variant="primary"
                        className="w-full"
                        disabled={!funded}
                        onClick={() => void setStep('entry', { history: 'replace' })}
                    >
                        {tCommon('continue')}
                    </Button>
                </PageStack.Footer>
            </PageStack>
        )
    }

    if (currentStep === 'available') {
        return (
            <CardMilestoneScreen
                funded={funded}
                onContinue={() => {
                    writeStoredValue(seenKey, '1')
                    void setStep(funded ? 'entry' : 'funding', { history: 'push' })
                }}
            />
        )
    }

    const lookingUp = currentStep === 'looking-up'
    return (
        <PageStack
            gap="6"
            className={getShakeClass(
                !reducedMotion && (lookingUp ? revealing : shake.on),
                lookingUp ? 'strong' : shake.intensity
            )}
        >
            <NavHeader title={t('onboarding.navTitle')} onPrev={onPrev} />
            <div className="flex flex-col gap-2 text-center" aria-live="polite">
                <h1 className="text-heading-s text-foreground-primary">
                    {t(lookingUp ? 'onboarding.lookingUpTitle' : 'eligibility.title')}
                </h1>
                <p className="text-body-m text-foreground-secondary">
                    {t(lookingUp ? 'onboarding.lookingUpBody' : 'eligibility.description')}
                </p>
            </div>
            <ScaledPixelatedCardFace last4="????" blurAll />
            {!lookingUp && (
                <PageStack.Footer>
                    <HoldToClaimButton
                        onComplete={() => void setStep('looking-up', { history: 'replace' })}
                        onShakeChange={(on, intensity) => setShake({ on, intensity })}
                        ariaLabel={t('eligibility.holdAriaLabel')}
                    >
                        {t('eligibility.cta')}
                    </HoldToClaimButton>
                </PageStack.Footer>
            )}
        </PageStack>
    )
}
