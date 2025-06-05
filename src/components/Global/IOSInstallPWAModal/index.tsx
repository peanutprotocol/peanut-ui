'use client'

import ActionModal, { ActionModalButtonProps } from '@/components/Global/ActionModal'
import { useEffect, useState } from 'react'
import { Icon } from '../Icons/Icon'

interface IOSInstallPWAModalProps {
    visible: boolean
    onClose: () => void
}

// basic iOS browser detection (can be refined)
const getIOSBrowserType = (): 'safari' | 'chrome' | 'brave' | 'firefox' | 'other' => {
    const ua = navigator.userAgent
    if (/CriOS/.test(ua)) {
        return 'chrome' // chrome on iOS
    }
    if (/FxiOS/.test(ua)) {
        return 'firefox' // firefox on iOS
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
    const [browserType, setBrowserType] = useState<'safari' | 'chrome' | 'brave' | 'firefox' | 'other'>('other')

    useEffect(() => {
        if (visible) {
            setBrowserType(getIOSBrowserType())
        }
    }, [visible])

    let descriptionTextJsx: React.ReactNode

    // default to standard instructions (Chrome, Safari, Arc)
    if (browserType === 'safari' || browserType === 'chrome' || browserType === 'other') {
        descriptionTextJsx = (
            <p className="flex flex-col items-center gap-1 text-sm text-grey-1">
                <span className="flex items-center gap-2">
                    Tap the
                    <span className="flex items-center gap-1 font-bold">
                        <Icon name="share" size={16} /> Share icon
                    </span>
                </span>
                <span>
                    {' '}
                    then on <span className="font-bold"> “Add To Home Screen”</span>
                </span>
            </p>
        )
    } else {
        // fallback for Brave and potentially other non-standard WebKit browsers
        descriptionTextJsx = (
            <p className="flex flex-col items-center gap-1 text-sm text-grey-1">
                <span className="flex items-center gap-2">Open the app in the Safari Browser,</span>
                <span className="flex items-center gap-2">
                    tap the
                    <span className="flex items-center gap-1 font-bold">
                        <Icon name="share" size={16} /> Share icon
                    </span>
                </span>
                <span>
                    {' '}
                    then on <span className="font-bold"> “Add To Home Screen”</span>
                </span>
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
        />
    )
}

export default IOSInstallPWAModal
