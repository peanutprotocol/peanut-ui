import { useTranslations } from 'next-intl'
import ActionModal from '../ActionModal'

interface CancelSendLinkModalProps {
    showCancelLinkModal: boolean
    setshowCancelLinkModal: (showCancelLinkModal: boolean) => void
    amount: string
    onClick: () => void | Promise<void>
    isLoading?: boolean
}

const CancelSendLinkModal = ({
    showCancelLinkModal,
    setshowCancelLinkModal,
    amount,
    onClick,
    isLoading = false,
}: CancelSendLinkModalProps) => {
    const t = useTranslations('global')

    const handleClick = (e?: React.MouseEvent<HTMLButtonElement>) => {
        // Stop event propagation to prevent Dialog from closing
        e?.preventDefault()
        e?.stopPropagation()

        // Call the actual onClick handler
        onClick()
    }

    return (
        <ActionModal
            visible={showCancelLinkModal}
            onClose={() => {
                if (!isLoading) {
                    setshowCancelLinkModal(false)
                }
            }}
            icon="link-slash"
            iconContainerClassName="bg-purple-1"
            iconProps={{ className: 'text-black' }}
            title={t('cancelSendLinkModal.title')}
            modalClassName="!z-[9999] pointer-events-auto"
            description={
                <>
                    {t.rich('cancelSendLinkModal.amountReturned', {
                        amount,
                        strong: (chunks) => <strong>{chunks}</strong>,
                    })}
                    <br />
                    <br />
                    {t('cancelSendLinkModal.noLongerClaimable')}
                </>
            }
            preventClose={isLoading}
            modalPanelClassName="max-w-sm mx-8 !z-[9999] pointer-events-auto"
            contentContainerClassName="relative pointer-events-auto"
            classOverlay="!bg-black/40 !z-[9998]"
            ctas={[
                {
                    text: t('cancelSendLinkModal.cancelCta'),
                    shadowSize: '4',
                    className: 'md:py-2',
                    onClick: handleClick,
                    loading: isLoading,
                    disabled: isLoading,
                },
            ]}
        />
    )
}

export default CancelSendLinkModal
