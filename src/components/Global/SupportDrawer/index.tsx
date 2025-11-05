'use client'

import { useSupportModalContext } from '@/context/SupportModalContext'
import { useCrispUserData } from '@/hooks/useCrispUserData'
import { useCrispProxyUrl } from '@/hooks/useCrispProxyUrl'
import { useCrispIframeReady } from '@/hooks/useCrispIframeReady'
import { Drawer, DrawerContent, DrawerTitle } from '../Drawer'
import PeanutLoading from '../PeanutLoading'
import { Button } from '@/components/0_Bruddle'
import ErrorAlert from '../ErrorAlert'

const SupportDrawer = () => {
    const { isSupportModalOpen, setIsSupportModalOpen, prefilledMessage } = useSupportModalContext()
    const userData = useCrispUserData()
    const crispProxyUrl = useCrispProxyUrl(userData, prefilledMessage)

    // Use shared hook with device-specific timeouts (3s desktop, 8s iOS)
    const { isReady, hasError, retry } = useCrispIframeReady(isSupportModalOpen)

    return (
        <Drawer open={isSupportModalOpen} onOpenChange={setIsSupportModalOpen}>
            <DrawerContent className="z-[999999] max-h-[85vh] w-screen pt-4">
                <DrawerTitle className="sr-only">Support</DrawerTitle>
                <div className="relative h-[80vh] w-full">
                    {!isReady && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
                            <PeanutLoading />
                        </div>
                    )}
                    {hasError && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
                            <div className="space-y-2">
                                <p className="text-base font-semibold">Having trouble loading support chat</p>
                                <p className="text-sm text-grey-1">
                                    Check your internet connection and try again. If the problem persists, you can email
                                    us at{' '}
                                    <a href="mailto:hello@peanut.to" className="text-purple-1 underline">
                                        hello@peanut.to
                                    </a>
                                </p>
                            </div>
                            <Button onClick={retry} shadowSize="4" variant="purple" icon="retry" iconSize={16}>
                                Try again
                            </Button>
                        </div>
                    )}
                    <iframe
                        src={crispProxyUrl}
                        className="h-full w-full"
                        style={{
                            height: '100%',
                            width: '100%',
                            minHeight: '-webkit-fill-available',
                        }}
                        title="Support Chat"
                    />
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default SupportDrawer
