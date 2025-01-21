'use client'

import { Card } from '@/components/0_Bruddle'

import { PaymentsFooter } from '@/components/Global/PaymentsFooter'

export const WrongPasswordClaimLink = () => {
    return (
        <Card className="space-y-3 shadow-none sm:shadow-primary-4">
            <Card.Header className="space-y-2">
                <Card.Title>Sorryyy</Card.Title>
                <Card.Description>This link is malformed. Are you sure you copied it correctly?</Card.Description>
            </Card.Header>
            <Card.Content className="space-y-2 text-start">
                <div className="block text-h8 font-normal">
                    We would like to hear from your experience. Hit us up on{' '}
                    <a className="text-link-decoration" target="_blank" href="https://discord.gg/BX9Ak7AW28">
                        Discord!
                    </a>
                </div>

                <div className="w-full">
                    <PaymentsFooter />
                </div>
            </Card.Content>
        </Card>
    )
}
