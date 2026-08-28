import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import { KycRegionRestrictedContent, useRegionRestrictedCta } from '../KycRegionRestrictedContent'

interface KycRegionRestrictedModalProps {
    visible: boolean
    onClose: () => void
}

/**
 * Terminal rejection caused by the document's jurisdiction.
 *
 * Deliberately takes no `onRetry` and no `onContactSupport` — the two endings
 * this screen exists to replace. Not offering them is the feature, so they are
 * absent from the props rather than merely unused, and a future caller cannot
 * quietly reintroduce either one.
 */
export const KycRegionRestrictedModal = ({ visible, onClose }: KycRegionRestrictedModalProps) => {
    const t = useTranslations('kyc.regionRestricted')
    const cta = useRegionRestrictedCta(onClose)

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon="globe-lock"
            iconContainerClassName="bg-action-primary"
            title={t('title')}
            content={
                <div className="w-full">
                    <KycRegionRestrictedContent />
                </div>
            }
            modalPanelClassName="max-w-full m-2"
            ctaClassName="grid grid-cols-1 gap-3"
            ctas={[
                {
                    text: cta.label,
                    onClick: cta.onClick,
                    variant: 'purple',
                    shadowSize: '4',
                    className: 'h-11',
                },
            ]}
        />
    )
}
