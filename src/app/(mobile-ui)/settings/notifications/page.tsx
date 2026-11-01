import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { NotificationsView } from '@/components/Settings/NotificationsView'

export const metadata = generateMetadata({
    title: 'Notifications | Peanut',
    description: 'Choose which notifications Peanut sends you.',
})

export default function NotificationsPage() {
    return (
        <PageContainer>
            <NotificationsView />
        </PageContainer>
    )
}
