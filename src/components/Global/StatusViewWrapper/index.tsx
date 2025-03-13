import { Card } from '@/components/0_Bruddle'
import { CrispButton } from '@/components/CrispChat'
import React from 'react'
import { PaymentsFooter } from '../PaymentsFooter'

interface SuccessViewProps {
    title: string
    description?: string
    children?: React.ReactNode
    hideSupportCta?: boolean
    supportCtaText?: string
}

const StatusViewWrapper = ({
    title,
    description,
    children,
    hideSupportCta = false,
    supportCtaText,
}: SuccessViewProps) => {
    return (
        <Card className="shadow-none sm:shadow-primary-4">
            <Card.Header className="space-y-2 border-0">
                <Card.Title className="mx-auto">{title}</Card.Title>
                {description && <Card.Description className="mx-auto">{description}</Card.Description>}
            </Card.Header>
            {children && (
                <Card.Content className="flex flex-col gap-2">
                    <div>{children}</div>
                </Card.Content>
            )}
            {!hideSupportCta && (
                <label className="py-3 text-center text-h9 font-normal">
                    {supportCtaText ? supportCtaText : 'We would like to hear from your experience.'}{' '}
                    <CrispButton className="text-black underline dark:text-white">Chat with support</CrispButton>
                </label>
            )}
            <div className="pt-2">
                <PaymentsFooter />
            </div>
        </Card>
    )
}

export default StatusViewWrapper
