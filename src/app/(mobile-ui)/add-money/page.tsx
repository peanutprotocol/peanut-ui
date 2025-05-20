import PageContainer from '@/components/0_Bruddle/PageContainer'
import { AddMoneyRouterView } from '@/components/AddMoney/views/AddMoneyRouter.view'

export default function AddMoneyPage() {
    return (
        <PageContainer className="min-h-[inherit] self-start">
            <AddMoneyRouterView />
        </PageContainer>
    )
}
