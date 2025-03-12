import { PEANUTMAN_BEER } from '@/assets'
import { Button } from '@/components/0_Bruddle'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import Icon from '../Icon'
import Modal from '../Modal'

export const RewardDetails = () => {
    return (
        <div className="w-full space-y-1 border border-black bg-purple-100 p-4">
            <div className="flex items-start justify-start gap-2">
                <Icon name="info" fill="black" className="h-4 w-4" />
                <div className="text-xs font-semibold">Exclusive benefits:</div>
            </div>
            <ul className="list-disc space-y-1 px-4 text-xs">
                <li className="list-item">You will receive 1 additional beer each week during the event</li>
                <li className="list-item">Visit our booth to unlock more rewards</li>
            </ul>
        </div>
    )
}

export const PartnerBarLocation = () => {
    return (
        <Link
            // casa temple location
            href={'https://maps.app.goo.gl/DmHaJzjKuCQLSRD27'}
            rel="noreferrer noopenner"
            target="_blank"
            className="font-semibold underline"
        >
            partner bar.
        </Link>
    )
}

const RewardsModal = () => {
    const [showModal, setShowModal] = useState<boolean>(true)

    return (
        <div className="relative">
            <Modal
                hideOverlay
                visible={showModal}
                onClose={() => setShowModal(false)}
                className="items-center rounded-none"
                classWrap="sm:m-auto sm:self-center self-center m-4 bg-background rounded-none border-0"
            >
                {/* Main content container */}
                <div className="relative z-10 w-full bg-white px-6 pb-6 pt-6">
                    <div className="space-y-4">
                        <div className="space-y-3 text-center">
                            <div className="space-y-2">
                                <h3 className="text-h3 font-extrabold">Welcome to Peanut!</h3>
                                <h5 className="text-h5 font-semibold">You've received 5 Beers!</h5>
                            </div>
                            <p className="text-xs">
                                During Crecimiento, in Buenos Aires, use your Pinta Tokens to enjoy free beers at any{' '}
                                <PartnerBarLocation />
                            </p>
                        </div>
                        <RewardDetails />
                        <Button
                            onClick={() => {
                                setShowModal(false)
                            }}
                            className="w-full"
                            variant="purple"
                        >
                            Claim your $PNT Tokens
                        </Button>
                    </div>
                </div>

                {/* Peanutman with beer character at the top */}
                <div
                    className="absolute left-0 top-0 flex w-full justify-center"
                    style={{ transform: 'translateY(-80%)' }}
                >
                    <div className="relative h-42 w-[90%] md:h-52">
                        <Image src={PEANUTMAN_BEER} alt="Peanut Man" layout="fill" objectFit="contain" />
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default RewardsModal
