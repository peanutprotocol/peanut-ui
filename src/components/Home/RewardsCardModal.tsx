import { Icon } from '@/components/Global/Icons/Icon'
import Modal from '@/components/Global/Modal'
import DirectSendQr from '../Global/DirectSendQR'
import { PartnerBarLocation } from '../Global/RewardsModal'

interface RewardsCardModalProps {
    visible: boolean
    onClose: () => void
}

export default function RewardsCardModal({ visible, onClose }: RewardsCardModalProps) {
    return (
        <Modal
            visible={visible}
            onClose={onClose}
            preventClose={false}
            classWrap="sm:m-auto sm:self-center self-center m-4 bg-background rounded-none border-0"
            className="items-center justify-center"
            title=""
            hideOverlay
        >
            <div className="flex flex-col items-center justify-center space-y-4 p-6 text-center">
                {/* Icon */}
                <div className="mb-2 flex size-14 items-center justify-center rounded-full bg-primary-1">
                    <Icon name="gift" className="size-8" fill="black" />
                </div>

                {/* Title */}
                <h2 className="text-xl font-bold text-black">You've got Beer tokens!</h2>

                {/* Text */}
                <p className="text-grey-1">
                    Scan the QR code at the bar's counter to claim your free beers at{' '}
                    <PartnerBarLocation text="participating bars." />
                </p>

                {/* Button */}
                <div className="w-full pt-2">
                    <DirectSendQr
                        icon="camera"
                        ctaTitle="Open Camera"
                        className="h-10 w-full rounded-sm font-bold"
                        iconClassName="size-4"
                    />
                </div>
            </div>
        </Modal>
    )
}
