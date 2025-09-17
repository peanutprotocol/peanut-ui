import { MERCADO_PAGO } from '@/assets'
import MantecaDetailsCard from '@/components/Global/MantecaDetailsCard'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants'

interface MantecaDepositCardProps {
    countryCodeForFlag: string
    currencySymbol: string
    amount: string
    cbu?: string
    alias?: string
    depositAddress?: string
    pixKey?: string
    isMercadoPago: boolean
}

const MantecaDepositCard = ({
    countryCodeForFlag,
    currencySymbol,
    amount,
    cbu,
    alias,
    depositAddress,
    pixKey,
    isMercadoPago,
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
                logo={isMercadoPago ? MERCADO_PAGO : undefined}
            />

            <h2 className="font-bold">Account details</h2>
            {(() => {
                const rows = [
                    ...(cbu
                        ? [{ key: 'cbu', label: 'CBU', value: cbu, allowCopy: true, hideBottomBorder: false }]
                        : []),
                    ...(alias ? [{ key: 'alias', label: 'Alias', value: alias, hideBottomBorder: false }] : []),
                    ...(depositAddress
                        ? [{ key: 'deposit', label: 'Deposit Address', value: depositAddress, hideBottomBorder: false }]
                        : []),
                    ...(pixKey ? [{ key: 'pix', label: 'Pix Key', value: pixKey, hideBottomBorder: false }] : []),
                ]
                if (rows.length) {
                    rows[rows.length - 1].hideBottomBorder = true
                }
                return <MantecaDetailsCard rows={rows} />
            })()}
        </div>
    )
}

export default MantecaDepositCard
