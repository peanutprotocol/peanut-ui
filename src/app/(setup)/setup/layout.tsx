import { SetupDocsProvider } from '@/components/Setup/components/SetupDocsDrawer'
import { loadSetupDocuments } from '@/components/Setup/components/setupDocuments.server'

export default async function SetupRouteLayout({ children }: { children: React.ReactNode }) {
    const documents = await loadSetupDocuments()
    return <SetupDocsProvider documents={documents}>{children}</SetupDocsProvider>
}
