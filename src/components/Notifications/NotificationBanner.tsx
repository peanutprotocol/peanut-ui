'use client'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ActionModal from '../Global/ActionModal'

const NotificationBanner = ({
    onClick,
    onClose,
    isPermissionDenied,
}: {
    onClick: () => void
    onClose: () => void
    isPermissionDenied: boolean
}) => {
    const [showBanner, setShowBanner] = useState(true)
    const [showPermissionDeniedModal, setShowPermissionDeniedModal] = useState(false)

    const handleClick = () => {
        onClick()
    }

    const handleHideBanner = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation()
        setShowBanner(false)
        onClose()
    }

    if (!showBanner) return null

    return (
        <>
            <Card
                position={'single'}
                onClick={() => {
                    if (isPermissionDenied) {
                        setShowPermissionDeniedModal(true)
                    } else {
                        handleClick()
                    }
                }}
            >
                <div className="flex items-center justify-between">
                    <div className="relative flex w-full items-center gap-3">
                        <div className="flex size-8 min-w-8 items-center justify-center rounded-full bg-primary-1">
                            <Icon name="bell" className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                            <div className="font-medium">Stay in the loop!</div>

                            <div className={twMerge('text-sm text-grey-1')}>
                                Turn on notifications and get alerts for all your wallet activity.
                            </div>
                        </div>
                        <button
                            type="button"
                            aria-label="Close"
                            onClick={handleHideBanner}
                            className="absolute right-0 top-2 w-fit cursor-pointer p-0 text-black"
                        >
                            <Icon name="cancel" className="h-3 w-3" />
                        </button>
                    </div>
                </div>
            </Card>
            {showPermissionDeniedModal && (
                <ActionModal
                    visible={showPermissionDeniedModal}
                    title="Turn notifications back on"
                    description={
                        <p>
                            <span>To keep getting updates, you'll need to reinstall the app on your home screen. </span>
                            <br />
                            <span>Don't worry, your account and data are safe. It only takes a minute.</span>
                        </p>
                    }
                    icon="bell"
                    onClose={() => {
                        setShowPermissionDeniedModal(false)
                    }}
                    ctaClassName="md:flex-col gap-4"
                    ctas={[
                        {
                            text: 'Got it!',
                            onClick: () => {
                                setShowPermissionDeniedModal(false)
                            },
                            shadowSize: '4',
                            variant: 'purple',
                        },
                        {
                            text: 'Not now',
                            onClick: () => {
                                setShowPermissionDeniedModal(false)
                            },
                            variant: 'transparent',
                            className: 'underline h-6',
                        },
                    ]}
                />
            )}
        </>
    )
}

export default NotificationBanner
