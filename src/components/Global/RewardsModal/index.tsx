import { PEANUTMAN_BEER, PEANUTMAN_RAISING_HANDS } from '@/assets'
import { Button } from '@/components/0_Bruddle'
import { useAuth } from '@/context/authContext'
import { rewardsApi } from '@/services/rewards'
import { RewardLink } from '@/services/services.types'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import Icon from '../Icon'
import Modal from '../Modal'
import { useRouter } from 'next/navigation'
import { hitUserMetric } from '@/utils/metrics.utils'

enum REWARD_ASSET_TYPE {
    'PNT' = 'aleph_pinta_mar_2025_welcome_pnt',
    'USDC' = 'aleph_pinta_mar_2025_welcome_usdc',
}

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
    const [rewardLinks, setRewardLinks] = useState<RewardLink[]>([])
    const [error, setError] = useState<string>('')
    const { user } = useAuth()
    const router = useRouter()

    // get active reward link (pnt first, then usdc)
    const getActiveReward = () => {
        const pntReward = rewardLinks.find((r) => r.assetCode === REWARD_ASSET_TYPE.PNT)
        const usdcReward = rewardLinks.find((r) => r.assetCode === REWARD_ASSET_TYPE.USDC)
        return pntReward || usdcReward
    }

    const activeReward = getActiveReward()

    // get modal content based on active reward
    const getModalContent = () => {
        //TODO: change after aleph event
        return {
            title: 'Welcome to Peanut!',
            subtitle: (
                <span>
                    Here's <span className="font-bold">$2</span> for you to explore{' '}
                    <span className="font-bold">Peanut Wallet</span> and its features!
                </span>
            ),
            ctaText: 'Chat with us to claim!',
        }
        /*
        if (!activeReward) return null

        const isPNTReward = activeReward.assetCode === REWARD_ASSET_TYPE.PNT

        return {
            title: isPNTReward ? 'Welcome to Peanut!' : `Wait, there's more!`,
            subtitle: isPNTReward ? (
                "You've received 2 Beers!"
            ) : (
                <span>
                    Here's <span className="font-bold">$5</span> for you to explore{' '}
                    <span className="font-bold">Peanut Wallet</span> and its features!
                </span>
            ),
            ctaText: isPNTReward ? 'Claim your Beers!' : 'Claim',
        }
        */
    }

    useEffect(() => {
        if (user) {
            rewardsApi
                .getByUser(user.user.userId)
                .then((res) => {
                    setRewardLinks(res)
                })
                .catch((_err) => {
                    console.log('rewards api err', _err)
                    setError('Failed to fetch rewards')
                })
        }
    }, [user])

    if (!rewardLinks.length || !activeReward) {
        return null
    }

    const modalContent = getModalContent()

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
                                <h3 className="text-h3 font-extrabold">{modalContent?.title}</h3>
                                <h5 className="text-h5 font-semibold">{modalContent?.subtitle}</h5>
                            </div>
                            {activeReward?.assetCode === REWARD_ASSET_TYPE.PNT ? (
                                <p className="text-xs">
                                    During Crecimiento, in Buenos Aires, use your Pinta Tokens to enjoy free beers at
                                    any <PartnerBarLocation />
                                </p>
                            ) : (
                                <p className="text-xs">Your seamless crypto experience starts now.</p>
                            )}
                        </div>
                        {activeReward?.assetCode === REWARD_ASSET_TYPE.PNT && <RewardDetails />}

                        <Button
                            className="w-full"
                            variant="purple"
                            onClick={() => {
                                hitUserMetric(user!.user.userId, 'click', { button: 'reward_modal_cta' })
                                const link = activeReward!.link
                                if (link.startsWith(process.env.NEXT_PUBLIC_BASE_URL!)) {
                                    router.push(activeReward!.link)
                                } else {
                                    window.open(activeReward!.link, '_blank')
                                }
                            }}
                        >
                            {modalContent?.ctaText}
                        </Button>
                    </div>
                </div>

                {/* Peanutman with beer character at the top */}
                <div
                    className="absolute left-0 top-0 flex w-full justify-center"
                    style={{ transform: 'translateY(-80%)' }}
                >
                    <div className="relative h-42 w-[90%] md:h-52">
                        <Image
                            src={
                                activeReward?.assetCode === REWARD_ASSET_TYPE.PNT
                                    ? PEANUTMAN_BEER
                                    : PEANUTMAN_RAISING_HANDS
                            }
                            alt="Peanut Man"
                            layout="fill"
                            objectFit="contain"
                        />
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default RewardsModal
