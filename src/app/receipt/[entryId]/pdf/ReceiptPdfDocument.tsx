import path from 'path'
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import { ReceiptPdfWordmark } from './receipt-pdf-wordmark'
// `import type` (not `import { type … }`): guaranteed statement-level elision,
// so this module's runtime graph stays react-pdf-only.
import type { ReceiptPdfModel } from './receipt-pdf-model'

// Same brand fonts the OG receipt image uses (src/app/api/og/route.tsx).
const fontDir = path.join(process.cwd(), 'src', 'assets', 'fonts')
Font.register({
    family: 'Montserrat',
    fonts: [
        { src: path.join(fontDir, 'montserrat-medium.ttf'), fontWeight: 500 },
        { src: path.join(fontDir, 'montserrat-semibold.ttf'), fontWeight: 600 },
    ],
})
// Prose must never hyphenate, and an identifier must never gain a hyphen: a
// 66-char tx hash is wider than the value column, so with no break opportunity
// it overflows the row — but breaking it via the hyphenation callback makes
// react-pdf render a hyphen at the break, which corrupts a hash someone reads
// off the page. So keep hyphenation off entirely and give identifier-like
// values zero-width break opportunities instead (see `breakableIdentifier`).
Font.registerHyphenationCallback((word) => [word])

const IDENTIFIER_MIN_LENGTH = 24
const IDENTIFIER_LINE_LENGTH = 40

const isIdentifierLike = (value: string) =>
    value.length >= IDENTIFIER_MIN_LENGTH && /^[0-9a-zA-Z:_-]+$/.test(value) && /[0-9]/.test(value)

/**
 * Hard-wraps a long unbroken identifier so it stays inside its column.
 *
 * Two approaches were rejected first: the hyphenation callback DOES wrap, but
 * react-pdf renders a hyphen at the break, and a hash someone reads off the
 * page must not gain a character; zero-width spaces are invisible but react-pdf
 * does not treat them as break opportunities, so the value still overflowed.
 * An explicit newline is deterministic and adds no visible character. The line
 * length is conservative for the value column at this font size — the wrap only
 * needs to beat the column, not fill it exactly. Copied text carries the
 * newlines, which is the accepted trade-off for never altering the characters.
 */
export function breakableIdentifier(value: string): string {
    if (!isIdentifierLike(value)) return value
    const lines: string[] = []
    for (let i = 0; i < value.length; i += IDENTIFIER_LINE_LENGTH) {
        lines.push(value.slice(i, i + IDENTIFIER_LINE_LENGTH))
    }
    return lines.join('\n')
}

const grey = '#6A6A6A'
const border = '#000000'

const styles = StyleSheet.create({
    page: {
        fontFamily: 'Montserrat',
        fontWeight: 500,
        fontSize: 10,
        color: '#000000',
        paddingVertical: 48,
        paddingHorizontal: 56,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 28,
    },
    issuer: { textAlign: 'right', fontSize: 9, color: grey },
    issuerName: { fontWeight: 600 },
    title: { fontSize: 16, fontWeight: 600, marginBottom: 16 },
    amountCard: {
        borderWidth: 1.5,
        borderColor: border,
        borderRadius: 8,
        paddingVertical: 16,
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    amount: { fontSize: 24, fontWeight: 600 },
    convertedAmount: { fontSize: 11, color: grey, marginTop: 4 },
    status: { fontSize: 10, color: grey, marginTop: 6 },
    rowsCard: {
        borderWidth: 1.5,
        borderColor: border,
        borderRadius: 8,
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 24,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#D5D5D5',
        borderBottomStyle: 'dashed',
    },
    lastRow: { borderBottomWidth: 0 },
    rowLabel: { color: grey },
    rowValue: { maxWidth: 330, textAlign: 'right', fontWeight: 600 },
    footer: {
        position: 'absolute',
        left: 56,
        right: 56,
        bottom: 40,
    },
    footerRule: { borderTopWidth: 1, borderTopColor: border, marginBottom: 10 },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 24, marginBottom: 4 },
    footerLabel: { fontSize: 8, color: grey },
    footerValue: { fontSize: 8, textAlign: 'right', maxWidth: 340 },
    site: { fontSize: 8, color: grey, marginTop: 6 },
})

export function ReceiptPdfDocument({ model }: { model: ReceiptPdfModel }) {
    return (
        <Document title={model.title} author="Peanut" creator="peanut.me" producer="peanut.me">
            <Page size="A4" style={styles.page}>
                <View style={styles.header}>
                    <ReceiptPdfWordmark width={110} />
                    <View style={styles.issuer}>
                        <Text style={styles.issuerName}>{model.issuedBy}</Text>
                        <Text>{model.site}</Text>
                    </View>
                </View>

                <Text style={styles.title}>{model.title}</Text>

                <View style={styles.amountCard}>
                    <Text style={styles.amount}>{model.amountDisplay}</Text>
                    {model.convertedAmountDisplay && (
                        <Text style={styles.convertedAmount}>{model.convertedAmountDisplay}</Text>
                    )}
                    {model.statusLabel && <Text style={styles.status}>{model.statusLabel}</Text>}
                </View>

                <View style={styles.rowsCard}>
                    {model.rows.map((row, index) => (
                        <View
                            key={`${row.label}-${index}`}
                            style={index === model.rows.length - 1 ? [styles.row, styles.lastRow] : styles.row}
                        >
                            <Text style={styles.rowLabel}>{row.label}</Text>
                            <Text style={styles.rowValue}>{breakableIdentifier(row.value)}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.footer} fixed>
                    <View style={styles.footerRule} />
                    <View style={styles.footerRow}>
                        <Text style={styles.footerLabel}>{model.referenceLabel}</Text>
                        <Text style={styles.footerValue}>{breakableIdentifier(model.reference)}</Text>
                    </View>
                    <Text style={styles.site}>{`${model.issuedBy} - https://peanut.me`}</Text>
                </View>
            </Page>
        </Document>
    )
}

export async function renderReceiptPdf(model: ReceiptPdfModel): Promise<Buffer> {
    return renderToBuffer(<ReceiptPdfDocument model={model} />)
}
