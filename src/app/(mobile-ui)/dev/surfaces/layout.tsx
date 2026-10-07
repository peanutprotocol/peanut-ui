import { DEV_TOOLS_ENABLED } from '@/constants/dev-tools.consts'
import { SetupDocsProvider } from '@/components/Setup/components/SetupDocsDrawer'
import { loadSetupDocuments } from '@/components/Setup/components/setupDocuments.server'

/** Keep the isolated setup previews interactive in /dev/surfaces too. */
export default async function SurfacesLayout({ children }: { children: React.ReactNode }) {
    if (!DEV_TOOLS_ENABLED) return children
    const documents = await loadSetupDocuments()
    return <SetupDocsProvider documents={documents}>{children}</SetupDocsProvider>
}
