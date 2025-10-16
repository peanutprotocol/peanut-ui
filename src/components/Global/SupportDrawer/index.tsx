import { useSupportModalContext } from '@/context/SupportModalContext'
import { Drawer, DrawerContent, DrawerTitle } from '../Drawer'

const SupportDrawer = () => {
    const { isSupportModalOpen, setIsSupportModalOpen } = useSupportModalContext()
    return (
        <Drawer open={isSupportModalOpen} onOpenChange={setIsSupportModalOpen}>
            <DrawerContent className="z-[999999] max-h-[85vh] w-screen pt-4">
                <DrawerTitle className="sr-only">Support</DrawerTitle>
                <iframe
                    src="https://go.crisp.chat/chat/embed/?website_id=916078be-a6af-4696-82cb-bc08d43d9125"
                    className="h-[80vh] w-full"
                />
            </DrawerContent>
        </Drawer>
    )
}

export default SupportDrawer
