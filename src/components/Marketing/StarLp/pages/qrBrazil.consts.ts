/** The till price in every Brazil scene: the shop's dynamic Pix QR asks for R$ 18,00. */
export const QR_BRAZIL_AMOUNT_BRL = 18

/** The shop the Pix goes to (the Pay capture's payee, the Argentina page's Panadería La Esquina in Portuguese). */
export const QR_BRAZIL_SHOP_NAME = 'PADARIA DA ESQUINA'

/**
 * Where the app's own converted lines sit in the Pay capture
 * (src/assets/star-lp/qr-brazil-pay.webp, 390 × 656 CSS px at capture).
 * The capture keeps their space blank, and the page writes the live values
 * there in the app's type, so the screen shows today's rate, not the rate on
 * capture day. Measured by the capture script (inbox/lp-refresh-2026/
 * build-shots/r2/capture-qr-brazil/capture-info.json).
 */
export const QR_BRAZIL_PAY_CAPTURE = {
    width: 390,
    height: 656,
    /** "≈ USD 3.64": centred on the amount card, 18px bold. */
    converted: { centerX: 187.5, top: 299, fontSize: 18, lineHeight: 24 },
    /** "1 USD = 4.937 BRL": left-aligned in the details card, 14px bold. */
    rate: { left: 33, top: 405, fontSize: 14, lineHeight: 20 },
} as const

/**
 * The pink Pay button in each capture (box plus its 4px hard shadow), in CSS
 * px at capture. The capture without the rate rows (qr-brazil-pay-norate.webp)
 * is shorter, so its button sits higher. Same capture-info.json.
 */
export const QR_BRAZIL_PAY_BUTTON = {
    live: { height: 656, left: 16, top: 592, width: 347, buttonHeight: 48 },
    norate: { height: 559, left: 16, top: 495, width: 347, buttonHeight: 48 },
} as const

/**
 * The white code card in the scanner capture (src/assets/iphone-ss/manteca_ss.webp,
 * 451 × 900 px; the hero shows its top 520 px). The photo's own code decodes
 * to a Wikipedia URL, so the page lays the sticker's real code over it: the
 * scanner reads the sticker next to it.
 */
export const QR_BRAZIL_SCANNER_CODE = {
    left: 115 / 451,
    top: 243 / 520,
    width: 221 / 451,
    height: 220 / 520,
} as const

/**
 * The page's own motion (the QrArgentinaMotionStyle pattern, so the shared
 * star LP kit in globals.css stays untouched): the hero scan bar (Split's
 * ScanningAnimation timing: a 1.8s sweep, then 1.2s rest), a hero sticker
 * that rocks three times and then rests, the Pay button press, and a hover
 * lift on everything that opens signup. Transform and opacity only.
 */
export const QR_BRAZIL_MOTION_CSS = `
.qr-br-scanline{display:none;position:absolute;inset-inline:0;top:0;height:18%;background:linear-gradient(to bottom,transparent,color-mix(in srgb,var(--color-pink-500) 60%,transparent),transparent);transform:translateY(-100%)}
.qr-br-press{transition:transform 170ms ease-out,scale 150ms ease-out}
.qr-br-tap::after{content:'';position:absolute;left:3.2%;top:16.7%;width:92.5%;height:61.1%;border-radius:9999px;background:#000;opacity:0}
@media (hover:hover) and (prefers-reduced-motion:no-preference){
.qr-br-press:hover{transform:translateY(-4px) rotate(-1deg)}
.qr-br-wobble:hover,.qr-br-wobble:has(:hover){animation-play-state:paused}
}
@media (prefers-reduced-motion:no-preference){
.qr-br-scanline{display:block;animation:qr-br-scan 3s linear 900ms infinite both}
.qr-br-wobble{animation:qr-br-wobble 2.4s ease-in-out 600ms 3}
.qr-br-tap[data-pressed='true']{animation:qr-br-tap 180ms ease-out 250ms}
.qr-br-tap[data-pressed='true']::after{animation:qr-br-flash 180ms ease-out 250ms}
}
@keyframes qr-br-scan{0%{transform:translateY(-100%)}60%,100%{transform:translateY(556%)}}
@keyframes qr-br-wobble{25%{transform:rotate(-3deg)}75%{transform:rotate(3deg)}}
@keyframes qr-br-tap{50%{transform:scale(.96)}}
@keyframes qr-br-flash{50%{opacity:.08}}
`
