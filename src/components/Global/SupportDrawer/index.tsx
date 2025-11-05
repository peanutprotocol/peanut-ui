'use client'

import { useSupportModalContext } from '@/context/SupportModalContext'
import { useCrispUserData } from '@/hooks/useCrispUserData'
import { useCrispProxyUrl } from '@/hooks/useCrispProxyUrl'
import { Drawer, DrawerContent, DrawerTitle } from '../Drawer'
import { CrispIframe } from '../CrispIframe'

const SupportDrawer = () => {
    const { isSupportModalOpen, setIsSupportModalOpen, prefilledMessage } = useSupportModalContext()
    const userData = useCrispUserData()
    const crispProxyUrl = useCrispProxyUrl(userData, prefilledMessage)

    return (
        <Drawer open={isSupportModalOpen} onOpenChange={setIsSupportModalOpen}>
            <DrawerContent className="z-[999999] max-h-[85vh] w-screen pt-4">
                <DrawerTitle className="sr-only">Support</DrawerTitle>
                <div className="relative h-[80vh] w-full">
                    <CrispIframe crispProxyUrl={crispProxyUrl} enabled={isSupportModalOpen} />
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default SupportDrawer
