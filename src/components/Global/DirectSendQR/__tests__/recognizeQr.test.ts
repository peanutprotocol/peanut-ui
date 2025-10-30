import { recognizeQr, EQrType } from '../utils'

describe('recognizeQr', () => {
    describe('PEANUT_URL', () => {
        it.each([
            ['https://peanut.example.org/claim/123', 'basic claim link'],
            ['https://peanut.example.org/link/abc', 'basic link'],
            ['https://peanut.example.org/something-else', 'other path'],
            ['https://peanut.example.org/', 'root path'],
            ['https://peanut.example.org', 'without trailing slash'],
            ['https://peanut.example.org/path?query=param', 'with query params'],
            ['https://peanut.example.org/path#fragment', 'with fragment'],
        ])('should recognize %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).toBe(EQrType.PEANUT_URL)
        })
    })

    describe('EVM_ADDRESS', () => {
        it.each([
            ['0x1234567890123456789012345678901234567890', 'lowercase address'],
            ['0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed', 'checksummed address'],
            ['0x0000000000000000000000000000000000000000', 'zero address'],
            ['0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF', 'max address'],
        ])('should recognize %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).toBe(EQrType.EVM_ADDRESS)
        })

        it.each([
            ['0x123', 'too short'],
            ['0x12345678901234567890123456789012345678901', 'too long (41 chars)'],
            ['0x123456789012345678901234567890123456789g', 'invalid hex character'],
            ['1234567890123456789012345678901234567890', 'missing 0x prefix'],
            ['0X1234567890123456789012345678901234567890', 'uppercase X prefix'],
            ['0xABCDEF1234567890123456789012345678901234', 'invalid checksum'],
            ['0xAbCdEf1234567890123456789012345678901234', 'invalid checksum mixed case'],
        ])('should NOT recognize %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).not.toBe(EQrType.EVM_ADDRESS)
        })
    })

    describe('ENS_NAME', () => {
        it.each([
            ['vitalik.eth', '.eth domain'],
            ['jota.peanut.me', '.me domain'],
            ['sub.domain.eth', 'subdomain'],
            ['test.crypto', '.crypto domain'],
            ['user.wallet', '.wallet domain'],
            ['www.example.com', 'www subdomain'],
            ['example.com', 'basic domain'],
        ])('should recognize %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).toBe(EQrType.ENS_NAME)
        })

        it.each([
            ['noextension', 'no TLD'],
            ['.eth', 'only TLD'],
            ['test.', 'trailing dot'],
            ['.test.eth', 'leading dot'],
            ['test..eth', 'double dot'],
        ])('should NOT recognize %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).not.toBe(EQrType.ENS_NAME)
        })
    })

    describe('EIP_681', () => {
        it.each([
            ['ethereum:0x1234567890123456789012345678901234567890', 'basic ethereum URI'],
            ['ethereum:0x1234567890123456789012345678901234567890?value=1e18', 'with value parameter'],
            ['ethereum:0x1234567890123456789012345678901234567890@1', 'with chain ID'],
            ['ethereum:0x1234567890123456789012345678901234567890@1?value=1e18', 'with chain ID and value'],
            [
                'ethereum:0x1234567890123456789012345678901234567890/transfer?address=0xabcd&uint256=1000',
                'with transfer function',
            ],
            ['ETHEREUM:0x1234567890123456789012345678901234567890', 'uppercase protocol'],
            ['ethereum:pay-0x1234567890123456789012345678901234567890', 'with pay- prefix'],
        ])('should recognize %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).toBe(EQrType.EIP_681)
        })

        it.each([
            ['eth:0x1234567890123456789012345678901234567890', 'wrong protocol'],
            ['ethereum:', 'missing address'],
            ['0x1234567890123456789012345678901234567890', 'missing protocol'],
        ])('should NOT recognize %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).not.toBe(EQrType.EIP_681)
        })

        it('should recognize ethereum:123 (EIP-681 regex allows any address-like pattern)', () => {
            // The regex matches this even though it's not a valid address
            expect(recognizeQr('ethereum:123')).toBe(EQrType.EIP_681)
        })
    })

    describe('MERCADO_PAGO', () => {
        it.each([
            [
                '00020101021143530016com.mercadolibre0129https://mpago.la/pos/8431598450150011307086329925204970053030325802AR5917Universo Aventura6004CABA630485DD',
                'standard mercadolibre QR',
            ],
            [
                '00020101021243530015com.mercadopago0120merchant-id-here5204970053030325802AR5909Test Store6004CABA6304ABCD',
                'with mercadopago identifier',
            ],
        ])('should recognize %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).toBe(EQrType.MERCADO_PAGO)
        })

        it.each([
            [
                '00020101021143530016com.mercadolibre0129https://mpago.la/pos/8431598450150011307086329925204970053030325802BR5917Universo Aventura6004CABA630485DD',
                'wrong country code (BR instead of AR)',
            ],
            [
                '00020101021143530016com.mercadolibre0129https://mpago.la/pos/8431598450150011307086329925204970053039865802AR5917Universo Aventura6004CABA630485DD',
                'wrong currency (986 instead of 032)',
            ],
            ['00020101021143530016com.mercadolibre5802AR6304ABCD', 'missing currency code'],
        ])('should NOT recognize %s as MERCADO_PAGO (%s)', (data, _description) => {
            expect(recognizeQr(data)).not.toBe(EQrType.MERCADO_PAGO)
        })
    })

    describe('ARGENTINA_QR3', () => {
        it.each([
            [
                '00020101021141280010com.prisma0110com.prisma44470007com.spr013230-71883062-8-NYRBSA191-166720385032001130718830628011330-71883062-85204546253030325802AR5909Venus Caf6014CAPITALFEDERAL62520309NYRBSA19107081667203850230007POSInfo01081667203863047867',
                'with com.prisma',
            ],
            [
                '00020101021244360012com.naranjax98113069226478599011501500113071649346252047299530303254073400.005802AR5906MAIREN6005TIGRE6108B1648EAV6240053677dcc59b-a279-437a-afb3-6f78d330445f630418AC',
                'with com.naranjax (fix/qr-as-ens test case)',
            ],
            [
                '00020101021230230019ar.com.globalgetnet41430019ar.com.globalgetnet981130714748293990115015001130714748293512600220000054350000001138503520473995802AR5919EXECUTIVE BIKES SRL6015CAPITAL FEDERAL6108C1426ZZZ53030325404360062480032f80aa7eea15f4edcb56fae375899c66a0708AR003YRG99360032f80aa7eea15f4edcb56fae375899c66a6304D6B9',
                'with globalgetnet',
            ],
            ['00020101021253030325802AR5909Test Store6004CABA6304ABCD', 'minimal valid Argentina QR3'],
        ])('should recognize %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).toBe(EQrType.ARGENTINA_QR3)
        })

        it.each([
            ['00020101021253030325802BR5909Test Store6004CABA6304ABCD', 'wrong country (BR)'],
            ['00020101021253039865802AR5909Test Store6004CABA6304ABCD', 'wrong currency (986)'],
            ['53030325802AR', 'missing EMV header'],
        ])('should NOT recognize %s as ARGENTINA_QR3 (%s)', (data, _description) => {
            expect(recognizeQr(data)).not.toBe(EQrType.ARGENTINA_QR3)
        })

        it('should recognize 00020101021253030325802AR as ARGENTINA_QR3 (regex matches incomplete QRs)', () => {
            // The regex uses lookaheads and matches even incomplete QRs
            expect(recognizeQr('00020101021253030325802AR')).toBe(EQrType.ARGENTINA_QR3)
        })
    })

    describe('PIX', () => {
        it.each([
            [
                '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
                'standard PIX QR',
            ],
            [
                'http://00020126850014br.gov.bcb.pix2563pix.voluti.com.br/qr/v3/at/c75d8412-3935-49d1-9d80-6435716962665204000053039865802BR5925SMARTPAY_SERVICOS_DIGITAI6013FLORIANOPOLIS62070503***6304575A',
                'PIX with URL prefix',
            ],
            [
                '00020126360014br.gov.bcb.pix0114+5511999999999520400005303986540510.005802BR5909Test User6009SAO PAULO62070503***6304ABCD',
                'PIX with phone number',
            ],
        ])('should recognize %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).toBe(EQrType.PIX)
        })

        it.each([
            [
                '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053030325802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
                'wrong currency (032 instead of 986)',
            ],
            [
                '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802AR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
                'wrong country (AR instead of BR)',
            ],
            ['00020153039865802BR', 'missing PIX identifier'],
        ])('should NOT recognize %s as PIX (%s)', (data, _description) => {
            expect(recognizeQr(data)).not.toBe(EQrType.PIX)
        })
    })

    describe('BITCOIN_ONCHAIN', () => {
        it.each([
            ['bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 'bech32 address (bc1q)'],
            ['1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', 'legacy P2PKH address (1)'],
            ['3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy', 'P2SH address (3)'],
            ['1111111111111111111114oLvT2', 'minimum length address'],
        ])('should recognize %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).toBe(EQrType.BITCOIN_ONCHAIN)
        })

        it('should NOT recognize very long bech32 addresses (too long for max 62 char limit)', () => {
            // Regex has max 39 chars after prefix, so total max is ~62 chars
            const tooLong = 'bc1pw508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7kt5nd6y'
            expect(recognizeQr(tooLong)).not.toBe(EQrType.BITCOIN_ONCHAIN)
        })

        it.each([
            ['bc1short', 'too short bech32'],
            ['1BvBM', 'too short legacy'],
            ['4J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy', 'invalid prefix (4)'],
            ['bc2qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 'invalid prefix (bc2)'],
            ['1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2ExtraTooLong', 'too long'],
            ['bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdqOIl', 'contains invalid chars (O, I, l)'],
        ])('should NOT recognize %s as BITCOIN_ONCHAIN (%s)', (data, _description) => {
            expect(recognizeQr(data)).not.toBe(EQrType.BITCOIN_ONCHAIN)
        })
    })

    describe('BITCOIN_INVOICE', () => {
        it.each([
            [
                'lnbc1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq8rkx3yf5tcsyz3d73gafnh3cax9rn449d9p5uxz9ezhhypd0elx87sjle52x86fux2ypatgddc6k63n7erqz25le42c4u4ecky03ylcqca784w',
                'mainnet invoice',
            ],
            ['lnbc1230n1pjj2lx9pp5abc123', 'short mainnet invoice'],
            ['lntb1500n1pdn8g9fpp5def456', 'testnet invoice'],
            ['lnbcrt1u1pxyztuvpp5ghi789', 'regtest invoice'],
        ])('should recognize %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).toBe(EQrType.BITCOIN_INVOICE)
        })

        it.each([
            ['lnbc', 'too short'],
            ['lnxyz1234567890abc', 'invalid network prefix'],
            ['lightning:lnbc1234', 'with protocol prefix'],
            ['LNBC1234567890ABC', 'uppercase (case sensitive)'],
        ])('should NOT recognize %s as BITCOIN_INVOICE (%s)', (data, _description) => {
            expect(recognizeQr(data)).not.toBe(EQrType.BITCOIN_INVOICE)
        })
    })

    describe('TRON_ADDRESS', () => {
        it.each([
            ['TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC', 'standard Tron address'],
            ['TLPbUYXW2QS5E9BTbV4pnRVPRAXU7RJpmG', 'another valid address'],
            ['T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb', 'address with numbers'],
        ])('should recognize %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).toBe(EQrType.TRON_ADDRESS)
        })

        it.each([
            ['AJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC', 'wrong prefix (A)'],
            ['TJRy', 'too short'],
            ['TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeCExtraTooLong', 'too long'],
            ['TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDe0', 'contains 0 (invalid base58)'],
            ['TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeO', 'contains O (invalid base58)'],
        ])('should NOT recognize %s as TRON_ADDRESS (%s)', (data, _description) => {
            expect(recognizeQr(data)).not.toBe(EQrType.TRON_ADDRESS)
        })
    })

    describe('SOLANA_ADDRESS', () => {
        it.each([
            ['9ZNTfG4NyQgxy2SWjSiQoUyBPEvXT2xo7fKc5hPYYJ7b', 'standard Solana address (44 chars)'],
            ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'program address'],
            ['So11111111111111111111111111111111111111112', 'wrapped SOL (43 chars)'],
        ])('should recognize %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).toBe(EQrType.SOLANA_ADDRESS)
        })

        it('should recognize 11111111111111111111111111111111 as BITCOIN_ONCHAIN (priority over Solana)', () => {
            // This matches Bitcoin regex first due to order in REGEXES_BY_TYPE
            expect(recognizeQr('11111111111111111111111111111111')).toBe(EQrType.BITCOIN_ONCHAIN)
        })

        it.each([
            ['9ZNTfG4NyQgxy2SWj', 'too short (< 32 chars)'],
            ['9ZNTfG4NyQgxy2SWjSiQoUyBPEvXT2xo7fKc5hPYYJ7bTooLong', 'too long (> 44 chars)'],
            ['9ZNTfG4NyQgxy2SWjSiQoUyBPEvXT2xo7fKc5hPY0J7b', 'contains 0 (invalid base58)'],
            ['9ZNTfG4NyQgxy2SWjSiQoUyBPEvXT2xo7fKc5hPYOJ7b', 'contains O (invalid base58)'],
            ['9ZNTfG4NyQgxy2SWjSiQoUyBPEvXT2xo7fKc5hPYIJ7b', 'contains I (invalid base58)'],
            ['9ZNTfG4NyQgxy2SWjSiQoUyBPEvXT2xo7fKc5hPYlJ7b', 'contains l (invalid base58)'],
        ])('should NOT recognize %s as SOLANA_ADDRESS (%s)', (data, _description) => {
            expect(recognizeQr(data)).not.toBe(EQrType.SOLANA_ADDRESS)
        })
    })

    describe('XRP_ADDRESS', () => {
        it.each([
            ['rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY', 'standard XRP address'],
            ['rN7n7otQDd6FczFgLdlqtyMVrn3HMfgnL5', 'another valid address'],
            ['rrrrrrrrrrrrrrrrrrrrrhoLvTp', 'minimum XRP address'],
            ['rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv', 'long XRP address'],
        ])('should recognize %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).toBe(EQrType.XRP_ADDRESS)
        })

        it.each([
            ['xPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY', 'wrong prefix (x)'],
            ['rPEP', 'too short (< 25 chars)'],
            ['rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDYExtraTooLongAddress', 'too long (> 34 chars)'],
        ])('should NOT recognize %s as XRP_ADDRESS (%s)', (data, _description) => {
            expect(recognizeQr(data)).not.toBe(EQrType.XRP_ADDRESS)
        })

        it('should recognize XRP addresses even with invalid base58 chars (regex does not validate base58)', () => {
            // The regex pattern doesn't actually validate proper base58
            expect(recognizeQr('rPEPPER7kfTD9w2T04CQk6UCfuHM9c6GDY')).toBe(EQrType.XRP_ADDRESS)
            expect(recognizeQr('rPEPPER7kfTD9w2TOICQk6UCfuHM9c6GDY')).toBe(EQrType.XRP_ADDRESS)
        })
    })

    describe('SIMPLEFI_STATIC', () => {
        it.each([
            ['https://pagar.simplefi.tech/peanut-test/static', 'with /static path'],
            ['https://www.pagar.simplefi.tech/peanut-test/static', 'with www'],
            ['http://www.pagar.simplefi.tech/peanut-test/static', 'http protocol'],
            ['http://www.pagar.simplefi.tech/peanut-test/static?stupid=params', 'with query params'],
            ['http://www.pagar.simplefi.tech/peanut-test/static/?stupid=params', 'with trailing slash and params'],
            ['https://pagar.simplefi.tech/peanut-test?static=true', 'with static=true param'],
            ['https://pagar.simplefi.tech/peanut-test/?static=true', 'with trailing slash and static param'],
            ['www.pagar.simplefi.tech/peanut-test?static=true', 'without protocol'],
            ['pagar.simplefi.tech/peanut-test?static=true', 'without www and protocol'],
            ['https://pagar.simplefi.tech/merchant-123/static', 'with numeric merchant slug'],
        ])('should recognize %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).toBe(EQrType.SIMPLEFI_STATIC)
        })

        it.each([
            ['https://pagar.simplefi.tech/peanut-test', 'missing static indicator'],
            ['https://pagar.simplefi.tech/peanut-test/payment/123', 'dynamic payment path'],
            ['https://other-domain.com/peanut-test/static', 'wrong domain'],
            ['https://simplefi.tech/peanut-test/static', 'missing pagar subdomain'],
        ])('should NOT recognize %s as SIMPLEFI_STATIC (%s)', (data, _description) => {
            expect(recognizeQr(data)).not.toBe(EQrType.SIMPLEFI_STATIC)
        })
    })

    describe('SIMPLEFI_DYNAMIC', () => {
        it.each([
            ['https://pagar.simplefi.tech/1234/payment/5678', 'standard dynamic payment'],
            ['https://www.pagar.simplefi.tech/merchant-slug/payment/pay-id-123', 'with www'],
            ['http://pagar.simplefi.tech/abc/payment/def', 'http protocol'],
            ['pagar.simplefi.tech/merchant/payment/payment-id', 'without protocol'],
        ])('should recognize %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).toBe(EQrType.SIMPLEFI_DYNAMIC)
        })

        it.each([
            ['https://pagar.simplefi.tech/1234/payment', 'missing payment ID'],
            ['https://pagar.simplefi.tech/payment/5678', 'missing merchant ID'],
            ['https://pagar.simplefi.tech/1234/pay/5678', 'wrong path segment (pay vs payment)'],
        ])('should NOT recognize %s as SIMPLEFI_DYNAMIC (%s)', (data, _description) => {
            expect(recognizeQr(data)).not.toBe(EQrType.SIMPLEFI_DYNAMIC)
        })
    })

    describe('SIMPLEFI_USER_SPECIFIED', () => {
        it.each([
            ['https://pagar.simplefi.tech/peanut-test', 'basic merchant slug'],
            ['https://www.pagar.simplefi.tech/merchant', 'with www'],
            ['http://pagar.simplefi.tech/shop-name', 'http protocol'],
            ['pagar.simplefi.tech/store', 'without protocol'],
            ['https://pagar.simplefi.tech/merchant-with-dashes', 'merchant with dashes'],
        ])('should recognize %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).toBe(EQrType.SIMPLEFI_USER_SPECIFIED)
        })

        it.each([
            ['https://other-domain.com/merchant', 'wrong domain'],
            ['https://simplefi.tech/merchant', 'missing pagar subdomain'],
        ])('should NOT recognize %s as SIMPLEFI_USER_SPECIFIED (%s)', (data, _description) => {
            expect(recognizeQr(data)).not.toBe(EQrType.SIMPLEFI_USER_SPECIFIED)
        })

        it('should recognize https://pagar.simplefi.tech/ as SIMPLEFI_USER_SPECIFIED (regex matches trailing slash)', () => {
            // The regex captures an empty merchant slug with trailing slash
            expect(recognizeQr('https://pagar.simplefi.tech/')).toBe(EQrType.SIMPLEFI_USER_SPECIFIED)
        })
    })

    describe('URL (generic)', () => {
        it.each([
            ['https://example.com', 'basic https URL'],
            ['http://domain.co.uk/path', 'http with path'],
            ['https://sub.domain.example.com/path/to/resource', 'subdomain with path'],
            ['https://example.com:8080/path', 'with port'],
            ['https://example.com/path?query=value&other=param', 'with query params'],
            ['https://example.com/path#fragment', 'with fragment'],
            ['http://192.168.1.1', 'IP address'],
            ['https://user:pass@example.com', 'with credentials'],
            ['example.com/path', 'domain with path, no protocol'],
            ['user@email.com', 'email (matches URL regex)'],
            ['https%3A%2F%2Fexample.com', 'URL encoded (matches URL regex)'],
        ])('should recognize %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).toBe(EQrType.URL)
        })

        it.each([
            ['example', 'no TLD'],
            ['just text', 'plain text with space'],
            ['ftp://example.com', 'unsupported protocol'],
            ['htp://example.com', 'typo in protocol'],
        ])('should NOT recognize %s as URL (%s)', (data, _description) => {
            expect(recognizeQr(data)).not.toBe(EQrType.URL)
        })
    })

    describe('NULL cases (unrecognized)', () => {
        it.each([
            ['', 'empty string'],
            ['random text without any pattern', 'random text'],
            ['123456', 'numbers only'],
            ['!@#$%^&*()', 'special characters'],
            ['   ', 'whitespace only'],
            ['this is just a sentence', 'regular sentence'],
            ['0x123', 'partial EVM address'],
            ['bc1short', 'partial Bitcoin address'],
            ['T123', 'partial Tron address'],
            ['ethereum:', 'incomplete EIP-681'],
            ['https://', 'incomplete URL'],
            ['lnbc', 'incomplete Lightning invoice'],
            ['test', 'single word'],
            ['test.', 'word with trailing dot'],
            ['@username', 'social media handle'],
            ['#hashtag', 'hashtag'],
            ['tel:+1234567890', 'phone number URI'],
            ['data:text/plain;base64,SGVsbG8=', 'data URI'],
        ])('should return null for %s (%s)', (data, _description) => {
            expect(recognizeQr(data)).toBeNull()
        })
    })

    describe('Priority and disambiguation', () => {
        it('should prioritize PEANUT_URL over generic URL', () => {
            const peanutUrl = 'https://peanut.example.org/test'
            expect(recognizeQr(peanutUrl)).toBe(EQrType.PEANUT_URL)
        })

        it('should prioritize EVM_ADDRESS over generic patterns', () => {
            const evmAddress = '0x1234567890123456789012345678901234567890'
            expect(recognizeQr(evmAddress)).toBe(EQrType.EVM_ADDRESS)
        })

        it('should prioritize MERCADO_PAGO over ARGENTINA_QR3 when both match', () => {
            const mercadoPagoQr =
                '00020101021143530016com.mercadolibre0129https://mpago.la/pos/8431598450150011307086329925204970053030325802AR5917Universo Aventura6004CABA630485DD'
            expect(recognizeQr(mercadoPagoQr)).toBe(EQrType.MERCADO_PAGO)
        })

        it('should prioritize SIMPLEFI_STATIC over SIMPLEFI_USER_SPECIFIED', () => {
            const staticUrl = 'https://pagar.simplefi.tech/merchant/static'
            expect(recognizeQr(staticUrl)).toBe(EQrType.SIMPLEFI_STATIC)
        })

        it('should prioritize SIMPLEFI_DYNAMIC over SIMPLEFI_USER_SPECIFIED', () => {
            const dynamicUrl = 'https://pagar.simplefi.tech/merchant/payment/123'
            expect(recognizeQr(dynamicUrl)).toBe(EQrType.SIMPLEFI_DYNAMIC)
        })

        it('should prioritize ENS_NAME over URL for valid ENS domains', () => {
            const ensName = 'vitalik.eth'
            expect(recognizeQr(ensName)).toBe(EQrType.ENS_NAME)
        })

        it('should prioritize EIP_681 over URL for ethereum: URIs', () => {
            const eip681 = 'ethereum:0x1234567890123456789012345678901234567890'
            expect(recognizeQr(eip681)).toBe(EQrType.EIP_681)
        })
    })

    describe('Case sensitivity', () => {
        it('should be case insensitive for EIP-681', () => {
            expect(recognizeQr('ethereum:0x1234567890123456789012345678901234567890')).toBe(EQrType.EIP_681)
            expect(recognizeQr('ETHEREUM:0x1234567890123456789012345678901234567890')).toBe(EQrType.EIP_681)
            expect(recognizeQr('Ethereum:0x1234567890123456789012345678901234567890')).toBe(EQrType.EIP_681)
        })

        it('should be case sensitive for Bitcoin Lightning invoices', () => {
            expect(recognizeQr('lnbc1230n1pjj2lx9pp5abc123')).toBe(EQrType.BITCOIN_INVOICE)
            expect(recognizeQr('LNBC1230N1PJJ2LX9PP5ABC123')).not.toBe(EQrType.BITCOIN_INVOICE)
        })

        it('should handle lowercase EVM addresses but reject invalid checksums', () => {
            expect(recognizeQr('0xabcdef1234567890123456789012345678901234')).toBe(EQrType.EVM_ADDRESS)
            // Invalid checksums are rejected by viem's isAddress()
            expect(recognizeQr('0xABCDEF1234567890123456789012345678901234')).not.toBe(EQrType.EVM_ADDRESS)
            expect(recognizeQr('0xAbCdEf1234567890123456789012345678901234')).not.toBe(EQrType.EVM_ADDRESS)
        })
    })

    describe('Edge cases and boundary conditions', () => {
        it('should handle very long strings gracefully', () => {
            const longString = 'a'.repeat(10000)
            expect(() => recognizeQr(longString)).not.toThrow()
            expect(recognizeQr(longString)).toBeNull()
        })

        it('should handle strings with newlines', () => {
            expect(recognizeQr('line1\nline2')).toBeNull()
            // Trailing newline breaks isAddress validation
            expect(recognizeQr('0x1234567890123456789012345678901234567890\n')).not.toBe(EQrType.EVM_ADDRESS)
        })

        it('should handle strings with tabs and spaces', () => {
            expect(recognizeQr('random\ttext')).toBeNull()
            expect(recognizeQr('  0x1234567890123456789012345678901234567890  ')).not.toBe(EQrType.EVM_ADDRESS) // Leading/trailing spaces should not match
        })

        it('should handle unicode characters', () => {
            expect(recognizeQr('测试')).toBeNull()
            expect(recognizeQr('emoji😀test')).toBeNull()
        })

        it('should handle URL encoded strings (matches URL regex)', () => {
            const urlEncoded = 'https%3A%2F%2Fexample.com'
            // The URL regex is permissive and matches this
            expect(recognizeQr(urlEncoded)).toBe(EQrType.URL)
        })
    })

    describe('False positives - Similar but invalid patterns', () => {
        it('should NOT match Solana addresses that are actually other crypto addresses', () => {
            // Bitcoin address (34 chars) should not match Solana
            const btcAddress = '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2'
            expect(recognizeQr(btcAddress)).not.toBe(EQrType.SOLANA_ADDRESS)
        })

        it('should NOT match random 40-character hex strings as EVM without 0x prefix', () => {
            const randomHex = '1234567890123456789012345678901234567890'
            expect(recognizeQr(randomHex)).not.toBe(EQrType.EVM_ADDRESS)
        })

        it('should NOT match domains that look like ENS but are not valid', () => {
            expect(recognizeQr('test..eth')).not.toBe(EQrType.ENS_NAME)
            expect(recognizeQr('.eth')).not.toBe(EQrType.ENS_NAME)
        })

        it('should NOT match incomplete EMV QR codes', () => {
            expect(recognizeQr('0002010102115802AR')).not.toBe(EQrType.ARGENTINA_QR3)
            expect(recognizeQr('0002010102115303032')).not.toBe(EQrType.ARGENTINA_QR3)
        })
    })

    describe('False negatives - Edge cases that should match', () => {
        it('should recognize minimum length Bitcoin addresses', () => {
            // Minimum P2PKH (26 chars)
            expect(recognizeQr('1111111111111111111114oLvT2')).toBe(EQrType.BITCOIN_ONCHAIN)
        })

        it('should recognize Bitcoin addresses at maximum length', () => {
            // Maximum P2SH (35 chars)
            expect(recognizeQr('3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy1')).toBe(EQrType.BITCOIN_ONCHAIN)
        })

        it('should recognize 32-char all-1s as BITCOIN_ONCHAIN (matches Bitcoin first)', () => {
            // Due to regex ordering, this matches Bitcoin before Solana
            expect(recognizeQr('11111111111111111111111111111111')).toBe(EQrType.BITCOIN_ONCHAIN)
        })

        it('should recognize XRP addresses at minimum length (25 chars)', () => {
            expect(recognizeQr('rrrrrrrrrrrrrrrrrrrrrhoLvTp')).toBe(EQrType.XRP_ADDRESS)
        })

        it('should recognize ENS names and URLs without protocol', () => {
            // www.example.com is recognized as ENS_NAME (checked before URL in regex loop)
            expect(recognizeQr('www.example.com')).toBe(EQrType.ENS_NAME)
            // example.com is also recognized as ENS_NAME (has TLD)
            expect(recognizeQr('example.com')).toBe(EQrType.ENS_NAME)
            // example.com/path has a slash so it matches URL
            expect(recognizeQr('example.com/path')).toBe(EQrType.URL)
        })
    })

    describe('fix/qr-as-ens - Payment QRs should not be recognized as ENS names', () => {
        it('should recognize Argentina QR3 with com.naranjax as ARGENTINA_QR3, not ENS_NAME', () => {
            const naranjaxQr =
                '00020101021244360012com.naranjax98113069226478599011501500113071649346252047299530303254073400.005802AR5906MAIREN6005TIGRE6108B1648EAV6240053677dcc59b-a279-437a-afb3-6f78d330445f630418AC'
            // This was incorrectly recognized as ENS_NAME before the fix
            // because "com.naranjax" matches the ENS_NAME regex pattern
            // Now it's correctly recognized as ARGENTINA_QR3 because payment processors are checked first
            expect(recognizeQr(naranjaxQr)).toBe(EQrType.ARGENTINA_QR3)
            expect(recognizeQr(naranjaxQr)).not.toBe(EQrType.ENS_NAME)
        })

        it('should check payment processors before ENS names in recognition order', () => {
            // Complete payment QRs are checked before ENS_NAME in the regex loop
            // The key insight: complete QRs match their specific regex first
            // Incomplete strings might match ENS_NAME, but that's expected behavior

            // These COMPLETE QRs should match their specific payment processor, not ENS_NAME
            const completePaymentQrs = [
                {
                    qr: '00020101021143530016com.mercadolibre0129https://mpago.la/pos/8431598450150011307086329925204970053030325802AR5917Universo Aventura6004CABA630485DD',
                    expected: EQrType.MERCADO_PAGO,
                },
                {
                    qr: '00020101021244360012com.naranjax98113069226478599011501500113071649346252047299530303254073400.005802AR5906MAIREN6005TIGRE6108B1648EAV6240053677dcc59b-a279-437a-afb3-6f78d330445f630418AC',
                    expected: EQrType.ARGENTINA_QR3,
                },
                {
                    qr: '00020101021141280010com.prisma0110com.prisma44470007com.spr013230-71883062-8-NYRBSA191-166720385032001130718830628011330-71883062-85204546253030325802AR5909Venus Caf6014CAPITALFEDERAL62520309NYRBSA19107081667203850230007POSInfo01081667203863047867',
                    expected: EQrType.ARGENTINA_QR3,
                },
            ]

            completePaymentQrs.forEach(({ qr, expected }) => {
                const result = recognizeQr(qr)
                expect(result).toBe(expected)
                expect(result).not.toBe(EQrType.ENS_NAME)
            })

            // Incomplete strings like "com.mercadolibre" might match ENS_NAME
            // This is expected - the fix ensures COMPLETE QRs are recognized correctly
            expect(recognizeQr('com.mercadolibre')).toBe(EQrType.ENS_NAME)
            expect(recognizeQr('ar.com.globalgetnet')).toBe(EQrType.ENS_NAME)
        })
    })
})
