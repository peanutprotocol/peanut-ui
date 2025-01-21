import { Button, Card } from '@/components/0_Bruddle'
import CopyField from '@/components/Global/CopyField'
import Icon from '@/components/Global/Icon'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import Link from 'next/link'
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
                <Link className="" href={'/profile'}>
                    <Button variant="stroke" className="flex flex-row justify-center text-nowrap">
                        <div className="border border-n-1 p-0 px-1">
                            <Icon name="profile" className="-mt-0.5" />
                        </div>
                        See your payments.
                    </Button>
                </Link>
            </Card.Content>
        </Card>
    )
}
