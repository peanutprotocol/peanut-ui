import Card from '@/components/Global/Card'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants'

interface MantecaDepositCardProps {
    countryCodeForFlag: string
    currencySymbol: string
    amount: string
    cbu?: string
    alias?: string
    depositAddress?: string
    pixKey?: string
}

const MantecaDepositCard = ({
    countryCodeForFlag,
    currencySymbol,
    amount,
    cbu,
    alias,
    depositAddress,
    pixKey,
}: MantecaDepositCardProps) => {
    return (
        <div className="my-auto flex h-full w-full flex-col justify-center space-y-4">
            <PeanutActionDetailsCard
                avatarSize="small"
                transactionType="ADD_MONEY_BANK_ACCOUNT"
                recipientType="BANK_ACCOUNT"
                recipientName="Your Bank Account"
                amount={amount}
                tokenSymbol={PEANUT_WALLET_TOKEN_SYMBOL}
                countryCodeForFlag={countryCodeForFlag}
                currencySymbol={currencySymbol}
            />

            <h2 className="font-bold">Account details</h2>
            <Card className="rounded-sm">
                {cbu && <PaymentInfoRow label={'CBU'} value={cbu} allowCopy={true} />}
                {alias && <PaymentInfoRow label={'Alias'} value={alias} hideBottomBorder />}
                {depositAddress && <PaymentInfoRow label={'Deposit Address'} value={depositAddress} hideBottomBorder />}
                {pixKey && <PaymentInfoRow label={'Pix Key'} value={pixKey} hideBottomBorder />}
            </Card>
        </div>
    )
}

export default MantecaDepositCard
