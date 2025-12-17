'use client'

import { useRouter } from 'next/navigation'
import Divider from '@/components/0_Bruddle/Divider'
import { ActionListCard } from '@/components/ActionListCard'
import IconStack from '@/components/Global/IconStack'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { ACTION_METHODS, type PaymentMethod } from '@/constants/actionlist.consts'
import { useGeoFilteredPaymentOptions } from '@/hooks/useGeoFilteredPaymentOptions'
import Loading from '@/components/Global/Loading'
import useKycStatus from '@/hooks/useKycStatus'
import { saveRedirectUrl } from '@/utils/general.utils'

interface PaymentMethodActionListProps {
    isAmountEntered: boolean
    showDivider?: boolean
}

/**
 * generic payment method action list for both direct send and semantic request flows
 * shows bank/mercadopago/pix options
 * redirects to setup with add-money as final destination after login/signup if user is not logged in
 * @param isAmountEntered - whether the amount is entered
 * @param showDivider - whether to show the divider
 * @returns the payment options list component
 */

export function PaymentMethodActionList({ isAmountEntered, showDivider = true }: PaymentMethodActionListProps) {
    const router = useRouter()
    const { isUserMantecaKycApproved, isUserBridgeKycApproved } = useKycStatus()

    // use geo filtering hook to sort methods based on user location
    // note: we don't mark verification-required methods as unavailable - they're still clickable
    const { filteredMethods: sortedMethods, isLoading: isGeoLoading } = useGeoFilteredPaymentOptions({
        sortUnavailable: true,
        isMethodUnavailable: (method) => method.soon,
        methods: ACTION_METHODS,
    })

    const handleMethodClick = (method: PaymentMethod) => {
        // for all methods, save current url and redirect to setup with add-money as final destination
        // verification will be handled in the add-money flow after login
        switch (method.id) {
            case 'bank':
            case 'mercadopago':
            case 'pix':
                saveRedirectUrl()
                const redirectUri = encodeURIComponent('/add-money')
                router.push(`/setup?redirect_uri=${redirectUri}`)
                break
        }
    }

    if (isGeoLoading) {
        return (
            <div className="flex w-full items-center justify-center py-8">
                <Loading />
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {showDivider && <Divider text="or" />}
            <div className="space-y-2">
                {sortedMethods.map((method) => {
                    // check if method requires verification (for badge display only)
                    const methodRequiresMantecaVerification =
                        ['mercadopago', 'pix'].includes(method.id) && !isUserMantecaKycApproved
                    const methodRequiresBridgeVerification = method.id === 'bank' && !isUserBridgeKycApproved
                    const methodRequiresVerification =
                        methodRequiresMantecaVerification || methodRequiresBridgeVerification
                    return (
                        <ActionListCard
                            key={method.id}
                            position="single"
                            description={method.description}
                            descriptionClassName="text-[12px]"
                            title={
                                <div className="flex items-center gap-2">
                                    {method.title}
                                    {(method.soon || methodRequiresVerification) && (
                                        <StatusBadge
                                            status={methodRequiresVerification ? 'custom' : 'soon'}
                                            customText={methodRequiresVerification ? 'REQUIRES VERIFICATION' : ''}
                                        />
                                    )}
                                </div>
                            }
                            onClick={() => handleMethodClick(method)}
                            isDisabled={method.soon || !isAmountEntered}
                            rightContent={<IconStack icons={method.icons} iconSize={method.id === 'bank' ? 80 : 24} />}
                        />
                    )
                })}
            </div>
        </div>
    )
}

// re-export for backward compatibility
export { PaymentMethodActionList as SendActionList }
