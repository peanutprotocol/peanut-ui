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
            title="Cancel this link?"
            modalClassName="!z-[9999] pointer-events-auto"
            description={
                <>
                    The <strong>{amount}</strong> locked in the link will go straight back to your balance.
                    <br />
                    <br />
                    Once cancelled, nobody will be able to claim it.
                </>
            }
            preventClose={isLoading}
            modalPanelClassName="max-w-sm mx-8 !z-[9999] pointer-events-auto"
            contentContainerClassName="relative pointer-events-auto"
            classOverlay="!bg-black/40 !z-[9998]"
            ctas={[
                {
                    text: 'Cancel & Return Funds',
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
