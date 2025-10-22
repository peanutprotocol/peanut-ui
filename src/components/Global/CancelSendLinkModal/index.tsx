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
    return (
        <ActionModal
            visible={showCancelLinkModal}
            onClose={() => !isLoading && setshowCancelLinkModal(false)}
            icon="link-slash"
            iconContainerClassName="bg-purple-1"
            iconProps={{ className: 'text-black' }}
            title="Cancel this link?"
            modalClassName="z-[9999]"
            description={
                <>
                    The <strong>{amount}</strong> locked in the link will go straight back to your balance.
                    <br />
                    <br />
                    Once cancelled, nobody will be able to claim it.
                </>
            }
            preventClose={isLoading}
            modalPanelClassName="max-w-sm mx-8"
            ctas={[
                {
                    text: 'Cancel & Return Funds',
                    shadowSize: '4',
                    className: 'md:py-2',
                    onClick,
                    loading: isLoading,
                    disabled: isLoading,
                },
            ]}
        />
    )
}

export default CancelSendLinkModal
