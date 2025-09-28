import { recognizeQr, EQrType } from '../utils'

describe('recognizeQr', () => {
    it.each([
        ['https://peanut.example.org/claim/123', EQrType.PEANUT_URL],
        ['https://peanut.example.org/link/abc', EQrType.PEANUT_URL],
        ['https://peanut.example.org/something-else', EQrType.PEANUT_URL],
        ['0x1234567890123456789012345678901234567890', EQrType.EVM_ADDRESS],
        ['0x0ff60f43e8c04d57c7374537d8432da8fedbb41d', EQrType.PINTA_MERCHANT],
        ['vitalik.eth', EQrType.ENS_NAME],
        ['jota.peanut.me', EQrType.ENS_NAME],
        ['ethereum:0x1234567890123456789012345678901234567890?value=1e18', EQrType.EIP_681],

        [
            '00020101021143530016com.mercadolibre0129https://mpago.la/pos/8431598450150011307086329925204970053030325802AR5917Universo Aventura6004CABA630485DD',
            EQrType.MERCADO_PAGO,
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
        ['random text without any pattern', null],
        ['123456', null],
        ['', null],
    ])('should recognize %s as %s', (data, expectedType) => {
        const result = recognizeQr(data)
        expect(result).toBe(expectedType)
    })
})
