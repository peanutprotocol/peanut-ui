'use client'

import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import { useHoldToClaim } from '@/hooks/useHoldToClaim'
import { Icon } from '@/components/Global/Icons/Icon'
import { getShakeClass } from '@/utils/perk.utils'
import { extractInviteeName } from '@/utils/general.utils'
import type { PendingPerk } from '@/services/perks'

interface PerkClaimCardProps {
    perk: PendingPerk
    onClaim: () => void
    isClaiming: boolean
}

export function PerkClaimCard({ perk, onClaim, isClaiming }: PerkClaimCardProps) {
    const { holdProgress, isShaking, shakeIntensity, buttonProps } = useHoldToClaim({
        onComplete: onClaim,
        disabled: isClaiming,
    })

    const inviteeName = extractInviteeName(perk.reason)

    return (
        <div className={getShakeClass(isShaking, shakeIntensity)}>
            <Card className="border-2 border-primary-1 bg-gradient-to-r from-primary-1/10 to-primary-2/10">
                <div className="mb-3 flex items-center gap-3">
                    <div className="flex items-center justify-center rounded-full bg-primary-1 p-2">
                        <Icon name="gift" className="size-5 text-white" />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-black">You earned ${perk.amountUsd}!</p>
                        <p className="text-sm text-grey-1">{inviteeName} became a Card Pioneer</p>
                    </div>
                </div>

                <Button
                    {...buttonProps}
                    variant="dark"
                    shadowSize="4"
                    disabled={isClaiming}
                    loading={isClaiming}
                    className={`${buttonProps.className} w-full`}
                >
                    {/* Progress fill from left to right */}
                    <div
                        className="absolute inset-0 bg-primary-1 transition-all duration-100"
                        style={{
                            width: `${holdProgress}%`,
                            left: 0,
                        }}
                    />
                    <span className="relative z-10">
                        {isClaiming ? 'Claiming...' : `Hold to claim $${perk.amountUsd}`}
                    </span>
                </Button>
            </Card>
        </div>
    )
}
