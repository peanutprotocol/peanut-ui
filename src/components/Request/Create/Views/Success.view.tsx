import CopyField from '@/components/Global/CopyField'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import StatusViewWrapper from '@/components/Global/StatusViewWrapper'
import * as _consts from '../Create.consts'

export const CreateRequestSuccessView = ({ link }: _consts.ICreateScreenProps) => {
    return (
        <StatusViewWrapper title="Yay!" hideSupportCta>
            <div className="flex flex-col gap-4">
                <QRCodeWrapper url={link} />
                <label className="text-center text-h8">
                    Share this link or QR with anyone. They will be able to pay you from any chain in any token.
                </label>
                <CopyField text={link} />
            </div>
        </StatusViewWrapper>
    )
}
