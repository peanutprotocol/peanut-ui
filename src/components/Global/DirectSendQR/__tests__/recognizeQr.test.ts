import { recognizeQr, EQrType } from '../utils'

describe('recognizeQr', () => {
    it.each([
        ['https://peanut.example.org/claim/123', EQrType.PEANUT_URL],
        ['https://peanut.example.org/link/abc', EQrType.PEANUT_URL],
        ['https://peanut.example.org/something-else', EQrType.PEANUT_URL],
        ['0x1234567890123456789012345678901234567890', EQrType.EVM_ADDRESS],
        ['vitalik.eth', EQrType.ENS_NAME],
        ['jota.peanut.me', EQrType.ENS_NAME],
        ['ethereum:0x1234567890123456789012345678901234567890?value=1e18', EQrType.EIP_681],

        [
            '00020101021143530016com.mercadolibre0129https://mpago.la/pos/8431598450150011307086329925204970053030325802AR5917Universo Aventura6004CABA630485DD',
            EQrType.MERCADO_PAGO,
        ],
        [
            '00020101021141280010com.prisma0110com.prisma44470007com.spr013230-71883062-8-NYRBSA191-166720385032001130718830628011330-71883062-85204546253030325802AR5909Venus Caf6014CAPITALFEDERAL62520309NYRBSA19107081667203850230007POSInfo01081667203863047867',
            EQrType.ARGENTINA_QR3,
        ],
        [
            '00020101021230230019ar.com.globalgetnet41430019ar.com.globalgetnet981130714748293990115015001130714748293512600220000054350000001138503520473995802AR5919EXECUTIVE BIKES SRL6015CAPITAL FEDERAL6108C1426ZZZ53030325404360062480032f80aa7eea15f4edcb56fae375899c66a0708AR003YRG99360032f80aa7eea15f4edcb56fae375899c66a6304D6B9',
            EQrType.ARGENTINA_QR3,
        ],
        ['bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', EQrType.BITCOIN_ONCHAIN],
        ['1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', EQrType.BITCOIN_ONCHAIN],
        [
            '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456- 4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
            EQrType.PIX,
        ],
        [
            'http://00020126850014br.gov.bcb.pix2563pix.voluti.com.br/qr/v3/at/c75d8412-3935-49d1-9d80-6435716962665204000053039865802BR5925SMARTPAY_SERVICOS_DIGITAI6013FLORIANOPOLIS62070503***6304575A',
            EQrType.PIX,
        ],
        ['TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC', EQrType.TRON_ADDRESS],
        ['9ZNTfG4NyQgxy2SWjSiQoUyBPEvXT2xo7fKc5hPYYJ7b', EQrType.SOLANA_ADDRESS],
        ['rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY', EQrType.XRP_ADDRESS],
        ['https://example.com', EQrType.URL],
        ['http://domain.co.uk/path', EQrType.URL],
        ['https://pagar.simplefi.tech/peanut-test/static', EQrType.SIMPLEFI_STATIC],
        ['https://www.pagar.simplefi.tech/peanut-test/static', EQrType.SIMPLEFI_STATIC],
        ['http://www.pagar.simplefi.tech/peanut-test/static', EQrType.SIMPLEFI_STATIC],
        ['https://pagar.simplefi.tech/peanut-test?static=true', EQrType.SIMPLEFI_STATIC],
        ['www.pagar.simplefi.tech/peanut-test?static=true', EQrType.SIMPLEFI_STATIC],
        ['pagar.simplefi.tech/peanut-test?static=true', EQrType.SIMPLEFI_STATIC],
        ['https://pagar.simplefi.tech/peanut-test', EQrType.SIMPLEFI_USER_SPECIFIED],
        ['https://pagar.simplefi.tech/1234/payment/5678', EQrType.SIMPLEFI_DYNAMIC],
        ['random text without any pattern', null],
        ['123456', null],
        ['', null],
    ])('should recognize %s as %s', (data, expectedType) => {
        const result = recognizeQr(data)
        expect(result).toBe(expectedType)
    })
})
