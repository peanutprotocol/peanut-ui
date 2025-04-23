import { use } from 'react'
import PaymentClient from './client'

type PageProps = {
    params: Promise<{ recipient?: string[] }>
}

export default function Page(props: PageProps) {
    const params = use(props.params)
    const recipient = params.recipient ?? []
    return <PaymentClient recipient={recipient} />
}
