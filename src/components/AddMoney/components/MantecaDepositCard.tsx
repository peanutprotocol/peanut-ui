import Card from '@/components/Global/Card'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants'

interface MantecaDepositCardProps {
    countryCodeForFlag: string
    currencySymbol: string
    amount: string
}

const MantecaDepositCard = ({ countryCodeForFlag, currencySymbol, amount }: MantecaDepositCardProps) => {
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
                <PaymentInfoRow label={'CBU'} value={'[CBU_NUMBER]'} allowCopy={true} />
                <PaymentInfoRow label={'Full name'} value={'Manuel Rodríguez Roldán'} />
                <PaymentInfoRow label={'[CUIL/CUIT]'} value={'20-39951628-6'} hideBottomBorder />
            </Card>
        </div>
    )
}

export default MantecaDepositCard
