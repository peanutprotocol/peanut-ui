'use client'
import { type FC } from 'react'
import Image from 'next/image'
import { PEANUT_LOGO_BLACK, PEANUTMAN_LOGO } from '@/assets'
import Modal from '../Modal'
import { Button } from '@/components/0_Bruddle/Button'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'

interface ConfirmInviteModalProps {
    isOpen: boolean
    onClose: () => void
    method: string
    handleLoseInvite: () => void
    handleContinueWithPeanut: () => void
}

const ConfirmInviteModal: FC<ConfirmInviteModalProps> = ({
    isOpen,
    onClose,
    method,
    handleLoseInvite,
    handleContinueWithPeanut,
}) => {
    return (
        <div className="relative">
            <Modal
                hideOverlay
                visible={isOpen}
                onClose={onClose}
                className="items-center rounded-none md:mx-auto md:max-w-md"
                classWrap="sm:m-auto sm:self-center self-center m-4 bg-background rounded-none border-0"
            >
                {/* Main content container */}
                <div className="relative z-10 w-full rounded-md bg-white px-6 py-6">
                    <div className="space-y-4">
                        <div className="space-y-3 text-center">
                            <div className="w-full space-y-2">
                                <h3 className={'text-xl font-extrabold text-black dark:text-white'}>
                                    Don’t lose your invite!
                                </h3>

                                <div className="text-base text-grey-1 dark:text-white">
                                    <p>
                                        {' '}
                                        This link lets you skip the Peanut waitlist. Using {method} will skip your
                                        invite.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Button className="w-full" shadowSize="4" variant="purple" onClick={handleContinueWithPeanut}>
                            <div>Join</div>
                            <div className="flex items-center gap-1">
                                <Image src={PEANUTMAN_LOGO} alt="Peanut Logo" className="size-5" />
                                <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
                            </div>
                        </Button>
                        <Button
                            className="h-6 !transform-none !pt-2 text-sm !font-normal underline"
                            variant="transparent"
                            onClick={handleLoseInvite}
                        >
                            Continue with {method}
                        </Button>
                    </div>
                </div>

                {/* Peanutman animation */}
                <div
                    className="absolute left-0 top-7 flex w-full justify-center"
                    style={{ transform: 'translateY(-80%)' }}
                >
                    <div className="relative h-42 w-[90%] md:h-52">
                        <Image src={chillPeanutAnim.src} alt="Peanut Man" className="object-contain" fill />
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default ConfirmInviteModal
