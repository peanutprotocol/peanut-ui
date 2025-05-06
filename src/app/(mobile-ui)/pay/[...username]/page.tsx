import PaymentClient from '@/app/[...recipient]/client'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { use } from 'react'

type PageProps = {
    params: Promise<{ username?: string[] }>
}

export default function PayPage(props: PageProps) {
    const params = use(props.params)
    const usernameSegments = params.username ?? []

    const recipient = usernameSegments

    return (
        <PageContainer className="self-start">
            <PaymentClient recipient={recipient} isDirectPay />
        </PageContainer>
    )
}
