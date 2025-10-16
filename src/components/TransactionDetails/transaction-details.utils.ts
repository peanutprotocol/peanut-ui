// union type for all possible rows in the receipt
export type TransactionDetailsRowKey =
    | 'createdAt'
    | 'claimed'
    | 'to'
    | 'tokenAndNetwork'
    | 'txId'
    | 'cancelled'
    | 'completed'
    | 'exchangeRate'
    | 'bankAccountDetails'
    | 'transferId'
    | 'depositInstructions'
    | 'networkFee'
    | 'fee'
    | 'peanutFee'
    | 'points'
    | 'comment'
    | 'attachment'
    | 'mantecaDepositInfo'

// order of the rows in the receipt
export const transactionDetailsRowKeys: TransactionDetailsRowKey[] = [
    'createdAt',
    'to',
    'tokenAndNetwork',
    'txId',
    'cancelled',
    'claimed',
    'completed',
    'fee',
    'exchangeRate',
    'bankAccountDetails',
    'transferId',
    'depositInstructions',
    'peanutFee',
    'points',
    'comment',
    'networkFee',
    'attachment',
]

export const getBankAccountLabel = (type: string) => {
    switch (type.toLowerCase()) {
        case 'iban':
            return 'IBAN'
        case 'clabe':
            return 'CLABE'
        default:
            return 'Account Number'
    }
}
