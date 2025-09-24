'use client'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import { Button } from '../0_Bruddle'
import Modal from '../Global/Modal'
import { SetupImageSection } from '../Setup/components/SetupWrapper'
import { useNotifications } from '@/hooks/useNotifications'

export default function SetupNotificationsModal() {
    const { showPermissionModal, requestPermission, closePermissionModal, afterPermissionAttempt } = useNotifications()

    const handleModalClose = () => {
        closePermissionModal()
    }

    return (
        <>
            <Modal
                visible={showPermissionModal}
                onClose={handleModalClose}
                classWrap="h-full w-full !max-w-none sm:!max-w-[600px] border-none sm:m-auto m-0"
                classButtonClose="hidden"
                preventClose={true}
                hideOverlay={false}
            >
                <div className="flex h-full w-full flex-col">
                    <SetupImageSection
                        layoutType="notification-permission"
                        image={chillPeanutAnim.src}
                        screenId="notification-permission"
                        customContainerClass="md:min-h-[10%] md:max-h-[50%] md:w-full"
                        imageClassName="w-full max-w-[80%] md:max-w-[75%] lg:max-w-xs object-contain relative"
                    />

                    <div className="flex h-[55%] flex-col bg-white p-4 md:p-6">
                        <div className="my-auto flex flex-col gap-2">
                            <h1 className="text-3xl font-extrabold">Don't miss a thing on Peanut</h1>
                            <div>
                                <p className="mt-2 text-lg font-medium">
                                    Instant alerts for your transactions, requests, and Peanut updates. Peace of mind
                                    and perks, straight to you.
                                </p>
                            </div>
                        </div>
                        <div className="mt-auto flex flex-col gap-2 pb-5">
                            <Button
                                variant="purple"
                                shadowSize="4"
                                onClick={async () => {
                                    try {
                                        await requestPermission()
                                        await afterPermissionAttempt()
                                    } finally {
                                        // Always close, even if requestPermission throws or user cancels
                                        closePermissionModal()
                                    }
                                }}
                            >
                                Enable notifications
                            </Button>
                            <Button className="my-auto" variant="transparent" onClick={handleModalClose}>
                                Not now
                            </Button>
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    )
}
