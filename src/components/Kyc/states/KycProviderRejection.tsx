'use client'

import { KYCStatusDrawerItem } from '../KYCStatusDrawerItem'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import type { ProviderRejectionInfo } from '@/hooks/useProviderRejectionStatus'

/**
 * shown when a user is sumsub-approved but a provider (bridge/manteca) rejected their documents.
 * displays two-level status: identity verified + provider-specific rejection with action.
 * onStartResubmission is called when user clicks "Upload document" — the parent (KycStatusDrawer)
 * handles the actual API call + SDK opening via sumsubFlow.handleSelfHealResubmit.
 */
export const KycProviderRejection = ({
    rejection,
    onStartResubmission,
}: {
    rejection: ProviderRejectionInfo
    onStartResubmission?: () => void
}) => {
    const providerLabel = rejection.provider === 'BRIDGE' ? 'Bank transfers' : 'QR payments'
    const isFixable = rejection.state === 'fixable'

    return (
        <div className="space-y-4 p-1">
            {/* identity verified status */}
            <KYCStatusDrawerItem status="completed" customText="Identity verified" />

            {/* provider-specific status */}
            <div className="rounded-sm border border-n-1 p-4">
                <div className="flex items-center gap-3">
                    <div
                        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                            isFixable ? 'bg-yellow-1' : 'bg-red-1'
                        }`}
                    >
                        <Icon name={isFixable ? 'alert' : 'failed'} size={16} />
                    </div>
                    <div>
                        <p className="font-semibold">
                            {providerLabel}: {isFixable ? 'action needed' : 'unavailable'}
                        </p>
                        <p className="text-sm text-grey-1">
                            {rejection.userMessage ||
                                (isFixable ? 'We need an updated document.' : 'Contact support for help.')}
                        </p>
                    </div>
                </div>

                {isFixable && rejection.selfHealAttempt > 0 && (
                    <p className="mt-2 text-xs text-grey-1">
                        Attempt {rejection.selfHealAttempt} of {rejection.maxAttempts}
                    </p>
                )}
            </div>

            {isFixable ? (
                <Button variant="purple" shadowSize="4" className="w-full" onClick={onStartResubmission}>
                    Upload document
                </Button>
            ) : (
                <Button
                    variant="stroke"
                    className="w-full"
                    onClick={() => {
                        if (typeof window !== 'undefined' && (window as any).$crisp) {
                            ;(window as any).$crisp.push(['do', 'chat:open'])
                        }
                    }}
                >
                    Contact support
                </Button>
            )}
        </div>
    )
}
