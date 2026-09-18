'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import { useTranslations } from 'next-intl'

/**
 * A corridor the user's residence does not reach.
 *
 * The account cannot open, so the screen states the rule and offers the one
 * thing that changes it — the residence on the account — and, where the country
 * still takes QR payments, the way in that works without an account. Both the
 * Bridge corridors (BRL) and the Manteca top-ups (ARS) reach this screen, so
 * the copy is keyed by the residence country rather than by any one provider's
 * flow.
 */

/** the residence-gated corridors, by the country each one opens for */
const CORRIDOR_COPY_BASE = {
    AR: 'corridors.BANK_TRANSFER_AR',
    BR: 'corridors.BANK_TRANSFER_BR',
} as const

export function ResidenceRequiredScreen({
    residenceIso2,
    qrPayHref,
    residenceChangeHref,
    onBack,
}: {
    /** the country the corridor opens for — the residence the user is missing */
    residenceIso2: keyof typeof CORRIDOR_COPY_BASE
    /** the QR flow any balance can pay from; omit where the country takes none */
    qrPayHref?: string
    /** where the user changes the residence on their account, already returnTo-wrapped */
    residenceChangeHref: string
    onBack: () => void
}) {
    const t = useTranslations('depositAccounts')
    const base = CORRIDOR_COPY_BASE[residenceIso2]
    // Residence closes the account, not the country: the QR payment stays open
    // wherever the user lives, so its line shows whenever the caller offers one.
    const qrPay = qrPayHref ? t(`${base}.qrPay`) : undefined

    return (
        <PageStack>
            <NavHeader title={t('title')} onPrev={onBack} />
            <PageStack.Center>
                <EmptyState
                    icon="globe-lock"
                    title={t(`${base}.residenceTitle`)}
                    description={
                        <span className="inline">
                            {t(`${base}.residenceRequired`)}
                            {qrPay ? ` ${qrPay}` : ''}
                        </span>
                    }
                    cta={
                        <div className="mt-4 flex w-full flex-col items-center gap-4">
                            {/* the residence row on Unlock payments, opened on arrival */}
                            <Button variant="purple" className="w-full" href={residenceChangeHref}>
                                {t('details.residenceCta')}
                            </Button>
                            {qrPayHref && (
                                <LinkButton href={qrPayHref} data-testid="corridor-qr-pay">
                                    {t('details.qrPayCta')}
                                </LinkButton>
                            )}
                        </div>
                    }
                />
            </PageStack.Center>
        </PageStack>
    )
}
