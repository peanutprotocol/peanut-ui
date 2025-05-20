import PageContainer from '@/components/0_Bruddle/PageContainer'
import { use } from 'react'
import PaymentClient from './client'

type PageProps = {
    params: Promise<{ recipient?: string[] }>
}

export default function Page(props: PageProps) {
    const params = use(props.params)
    const recipient = params.recipient ?? []
    return (
        <PageContainer className="min-h-[inherit]">
            <PaymentClient recipient={recipient} />
        </PageContainer>
    )
}
