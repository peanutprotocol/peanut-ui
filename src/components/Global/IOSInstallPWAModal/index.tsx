'use client'

import ActionModal, { ActionModalButtonProps } from '@/components/Global/ActionModal'
import { useEffect, useState } from 'react'
import { Icon } from '../Icons/Icon'

interface IOSInstallPWAModalProps {
    visible: boolean
    onClose: () => void
}

// basic iOS browser detection (can be refined)
const getIOSBrowserType = (): 'safari' | 'chrome' | 'brave' | 'other' => {
    const ua = navigator.userAgent
    if (/CriOS/.test(ua)) {
        return 'chrome' // chrome on iOS
    }
    if (/Brave/.test(ua) && /Mobile/.test(ua) && /Safari/.test(ua)) {
        return 'brave' // brave on iOS
    }
    if (
        /Safari/.test(ua) &&
        /Mobile/.test(ua) &&
        !/CriOS/.test(ua) &&
        !/FxiOS/.test(ua) &&
        !/EdgiOS/.test(ua) &&
        !/OPiOS/.test(ua) &&
        !/Brave/.test(ua)
    ) {
        return 'safari' // safari on iOS (excluding other WebKit browsers)
    }
    return 'other'
}

const IOSInstallPWAModal: React.FC<IOSInstallPWAModalProps> = ({ visible, onClose }) => {
    const [browserType, setBrowserType] = useState<'safari' | 'chrome' | 'brave' | 'other'>('other')

    useEffect(() => {
        if (visible) {
            setBrowserType(getIOSBrowserType())
        }
    }, [visible])

    let descriptionTextJsx: React.ReactNode

    // default to standard instructions (Chrome, Safari, Arc)
    if (browserType === 'safari' || browserType === 'chrome' || browserType === 'other') {
        descriptionTextJsx = (
            <p className="text-sm text-grey-1 dark:text-white">
                Tap the <Icon name="share" size={16} /> Share icon then on "Add To Home Screen"
            </p>
        )
    } else {
        // fallback for Brave and potentially other non-standard WebKit browsers
        descriptionTextJsx = (
            <p className="text-sm text-grey-1 dark:text-white">
                Open the app in the Safari Browser, tap the <Icon name="share" size={16} /> Share icon and then on "Add
                To Home Screen"
            </p>
        )
    }

    const ctas: ActionModalButtonProps[] = [
        {
            text: 'Close',
            onClick: onClose,
            variant: 'purple',
            shadowSize: '4',
        },
    ]

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title="Add Peanut to your Home Screen"
            description={descriptionTextJsx}
            icon="mobile-install"
            ctas={ctas}
            modalClassName="w-full max-w-xs"
        />
    )
}

export default IOSInstallPWAModal
