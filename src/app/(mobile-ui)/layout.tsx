import { AppHelpProvider } from '@/components/Global/AppHelpDrawer'
import { loadAppHelpDocuments } from '@/components/Global/appHelpDocuments.server'
import MobileLayoutClient from './MobileLayoutClient'
import '../../styles/globals.css'

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
    const documents = await loadAppHelpDocuments()
    return (
        <AppHelpProvider documents={documents}>
            <MobileLayoutClient>{children}</MobileLayoutClient>
        </AppHelpProvider>
    )
}
