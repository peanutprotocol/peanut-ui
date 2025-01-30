import { Card } from '@/components/0_Bruddle'
import CopyField from '@/components/Global/CopyField'
import { PaymentsFooter } from '@/components/Global/PaymentsFooter'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import * as _consts from '../Create.consts'

export const SuccessView = ({ link }: _consts.ICreateScreenProps) => {
    return (
        <Card className="shadow-none sm:shadow-primary-4">
            <Card.Header className="relative">
                <Card.Title>Yay!</Card.Title>
            </Card.Header>
            <Card.Content className="flex flex-col gap-3">
                <QRCodeWrapper url={link} />
                <label className="text-start text-h8">
                    Share this link or QR with anyone. They will be able to pay you from any chain in any token.
                </label>
                <CopyField text={link} />
                <PaymentsFooter />
            </Card.Content>
        </Card>
    )
}
