import { getTokenSymbol, validateEnsName } from '@/utils'
import { isAddress } from 'viem'

// Constants
const PINTA_MERCHANTS: Record<string, string> = {
    '0x0ff60f43e8c04d57c7374537d8432da8fedbb41d': 'Casa Temple',
}

export enum EQrType {
    PEANUT_URL = 'PEANUT_URL',
    ENS_NAME = 'ENS_NAME',
    PINTA_MERCHANT = 'PINTA_MERCHANT',
    EVM_ADDRESS = 'EVM_ADDRESS',
    URL = 'URL',
    EIP_681 = 'EIP_681',
    MERCADO_PAGO = 'MERCADO_PAGO',
    BITCOIN_ONCHAIN = 'BITCOIN_ONCHAIN',
    BITCOIN_INVOICE = 'BITCOIN_INVOICE',
    PIX = 'PIX',
    TRON_ADDRESS = 'TRON_ADDRESS',
    SOLANA_ADDRESS = 'SOLANA_ADDRESS',
    XRP_ADDRESS = 'XRP_ADDRESS',
}

export const NAME_BY_QR_TYPE: { [key in QrType]?: string } = {
    [EQrType.MERCADO_PAGO]: 'Mercado Pago',
    [EQrType.BITCOIN_ONCHAIN]: 'Bitcoin',
    [EQrType.BITCOIN_INVOICE]: 'Bitcoin',
    [EQrType.PIX]: 'PIX',
    [EQrType.TRON_ADDRESS]: 'Tron',
    [EQrType.SOLANA_ADDRESS]: 'Solana',
    [EQrType.XRP_ADDRESS]: 'Ripple',
}

export type QrType = `${EQrType}`

/**
 * Mercado Pago specific regex for Argentina
 * This regex looks for:
 * 1. Standard EMVco QR code format
 * 2. Argentina country code (5802AR)
 * 3. Argentine Peso currency (5303032)
 * 4. Possible Mercado Pago identifiers:
 *    - Merchant Account Information templates with IDs in range 26-51
 *    - Potentially containing "com.mercadopago" or similar domains
 *    - May include specific Additional Data Field Template values
 *  @see https://www.emvco.com/specifications/emv-qr-code-specification-for-payment-systems-emv-qrcps-merchant-presented-mode/
 */
const MP_AR_REGEX =
    /^000201((?!6304).)*(?:(?:26|27|28|29|30|31|35|43)\d{2}(?:0015com\.mercadopago|0016com\.mercadolibre)).*5303032.*5802AR((?!6304).)*6304[0-9A-F]{4}$/i

/* PIX is also a emvco qr code */
const PIX_REGEX = /^.*00020126.*0014br\.gov\.bcb\.pix.*5303986.*5802BR.*$/i

const EIP_681_REGEX = /^ethereum:(?:pay-)?([^@/?]+)(?:@([^/?]+))?(?:\/([^?]+))?(?:\?(.*))?$/i

const REGEXES_BY_TYPE: { [key in QrType]?: RegExp } = {
    [EQrType.EIP_681]: EIP_681_REGEX,
    [EQrType.MERCADO_PAGO]: MP_AR_REGEX,
    [EQrType.BITCOIN_ONCHAIN]: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/,
    [EQrType.BITCOIN_INVOICE]: /^ln(bc|tb|bcrt)([0-9]{1,}[a-z0-9]+){1}$/,
    [EQrType.PIX]: PIX_REGEX,
    [EQrType.XRP_ADDRESS]: /^r[0-9a-zA-Z]{24,34}$/,
    [EQrType.TRON_ADDRESS]: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
    [EQrType.SOLANA_ADDRESS]: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
    [EQrType.URL]:
        /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
}

export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!

export function recognizeQr(data: string): QrType | null {
    if (data.startsWith(BASE_URL)) {
        return EQrType.PEANUT_URL
    }
    if (isAddress(data)) {
        return PINTA_MERCHANTS[data] ? EQrType.PINTA_MERCHANT : EQrType.EVM_ADDRESS
    }
    if (validateEnsName(data)) {
        return EQrType.ENS_NAME
    }

    for (const [type, regex] of Object.entries(REGEXES_BY_TYPE)) {
        if (regex.test(data)) {
            return type as QrType
        }
    }
    return null
}

/**
 * Extracts EIP-681 parameters from an Ethereum URI
 * @param data The Ethereum URI string (e.g. "ethereum:0x123...?value=1e18")
 * @returns Object with extracted parameters
 */
export const parseEip681 = (
    data: string
): {
    address: string
    chainId?: string
    amount?: string
    tokenSymbol?: string
    tokenAddress?: string
} => {
    const match = data.match(EIP_681_REGEX)
    if (!match) {
        return { address: '' }
    }

    const address = match[1]
    const chainId = match[2]
    const functionName = match[3]
    const queryString = match[4] || ''
    const params = new URLSearchParams('?' + queryString)

    if (!functionName) {
        const value = params.get('value') || undefined
        return {
            address,
            chainId,
            amount: value,
            tokenSymbol: 'ETH',
        }
    }

    // Handle ERC-20 token transfer
    if (functionName.toLowerCase() === 'transfer') {
        const tokenAddress = address
        const recipientAddress = params.get('address') || ''
        const amount = params.get('uint256') || undefined
        return {
            address: recipientAddress,
            chainId,
            amount,
            tokenSymbol: getTokenSymbol(tokenAddress, chainId),
            tokenAddress,
        }
    }

    return { address }
}
