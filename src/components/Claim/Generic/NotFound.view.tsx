'use client'

import { Card } from '@/components/0_Bruddle'
import { PaymentsFooter } from '@/components/Global/PaymentsFooter'

export const NotFoundClaimLink = () => {
    return (
        <Card className="space-y-3 shadow-none sm:shadow-primary-4">
            <Card.Header className="mx-auto space-y-2">
                <Card.Title className="mx-auto text-center">Sorryyy</Card.Title>
                <Card.Description className="mx-auto text-center">
                    This link is malformed. Are you sure you copied it correctly?
                </Card.Description>
            </Card.Header>
            <Card.Content className="mx-auto space-y-2 text-center">
                <div className="block text-h8 font-normal">
                    Deposit not found. Are you sure your link is correct?
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
