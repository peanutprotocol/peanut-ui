'use client'

import { BulletList } from '@/components/0_Bruddle/BulletList'
import { Button } from '@/components/0_Bruddle/Button'
import { Notification } from '@/components/0_Bruddle/Notification'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import NavHeader from '@/components/Global/NavHeader'
import type { DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'

/**
 * The claim step — the one screen where the user decides to hold an account.
 *
 * It exists because the account is a commitment, not a lookup: it carries the
 * user's name, it can be handed to an employer, and it stays valid. Saying
 * what arrives and what the limits are before the tap is cheaper than a
 * support ticket after a payroll form already has the details.
 */
export function ClaimAccountScreen({
    rail,
    isClaiming,
    error,
    onClaim,
    onBack,
}: {
    rail: DepositRail
    isClaiming: boolean
    error?: string
    onClaim: () => void
    onBack: () => void
}) {
    const { t, arrivalDetail } = useDepositAccountCopy()

    return (
        <PageStack>
            <NavHeader title={t('title')} onPrev={onBack} />
            <div className="flex flex-col gap-6">
                <TitleBlock
                    size="s"
                    title={t('claim.heading', { currency: rail.currency })}
                    description={t('claim.subheading', { arrival: arrivalDetail(rail.corridor) })}
                />

                <BulletList
                    items={[
                        t('claim.benefitStable'),
                        t('claim.benefitAnyone'),
                        t('claim.benefitBalance'),
                        rail.thirdPartyCap
                            ? t('claim.benefitCap', { cap: rail.thirdPartyCap })
                            : t('claim.benefitNoReference'),
                    ]}
                />

                {error && (
                    <Notification priority="error" title={t('claim.errorTitle')}>
                        {error}
                    </Notification>
                )}
            </div>
            <PageStack.Footer>
                <Button
                    variant="purple"
                    className="w-full"
                    loading={isClaiming}
                    disabled={isClaiming}
                    onClick={onClaim}
                >
                    {t('claim.cta', { currency: rail.currency })}
                </Button>
            </PageStack.Footer>
        </PageStack>
    )
}
