# Banking illustrations (Lottie)

Object animations for banking concepts, drawn to the setup mascot's rules
(`src/assets/mascot/lottie/`) but without the mascot. Not wired into any screen yet.

- 1050 × 1000 canvas, 30 fps, seamless loops, transparent background, no fonts or images
- outlines 10.5 / 9 / 7.5, round caps; mascot palette (#FCC814, #E882D0, white, #F2B786, #CC485E, #FFC1CF, #46ACFF)
- authored to be played like `PeanutMascot`: each frame held twice (`MASCOT_HOLD_FRAMES`) at `MASCOT_SPEED`
- before rendering one through `PeanutMascot`, measure its art box the same way `MASCOT_ART_BOXES` is generated

| File | Topic | Animation | Suggested use | Frames |
| --- | --- | --- | --- | --- |
| `card-flip.json` | Card | The card hops and turns over: chip side, then signature side. | Card intro, “your card details” | 64 |
| `card-tap.json` | Card | The card swoops onto a terminal, contactless waves pulse, a check lands on the screen. | Card ready, Apple/Google Pay, “pay anywhere” | 72 |
| `card-wallet.json` | Card | A card springs up out of a wallet pocket, wiggles, and tucks back in. | Get your card, card delivered, virtual card issued | 64 |
| `card-stack.json` | Card | Three cards fan out from a stack like a hand of cards, then snap back together. | Virtual + physical cards, multiple cards, card options | 64 |
| `card-freeze.json` | Card | The card shivers, frosts over and a snowflake badge locks it; then it thaws. | Freeze / unfreeze card, card controls | 80 |
| `account-details.json` | Bank account | A statement writes itself line by line, then an approval stamp slams down. | Account number / IBAN, bank details ready, account opened | 80 |
| `wallet-topup.json` | Bank account | Coins drop into an open wallet one by one; it puffs up and a plus badge pops. | Add money, deposit, top up balance | 64 |
| `cash-out.json` | Bank account | A banknote slides out of a cash machine, flutters, and slides back in. | Withdraw, cash out to bank, offramp | 72 |
| `shield-check.json` | Security | A shield lands with a squash, a check draws itself, sparkles pop around it. | Account protected, security settings, “your money is safe” | 60 |
| `vault.json` | Security | A round vault door spins its wheel handle and settles with a thunk. | Funds held securely, custody, savings safety | 72 |
| `fingerprint.json` | Passkey | A scan bar sweeps a fingerprint pad, the ridges redraw and a check badge pops. | Create passkey, biometric sign-in | 72 |
| `phone-key.json` | Passkey | A progress ring draws around a key on a phone screen, the key pops, a check lands. | Passkey saved to device, set up passkey | 72 |
| `fee-scissors.json` | Fees | Scissors snip a ribbon printed with % signs; the cut end drops away and a fresh one feeds in. | Lower fees, fee cut, cheaper than banks | 64 |
| `receipt.json` | Fees | A receipt prints out in little jerks, line by line, then tears off and drops. | Transparent pricing, fee breakdown, payment summary | 72 |
| `coin-swap.json` | Exchange | A dollar and a euro coin orbit each other and trade places with a bouncy overshoot. | Exchange rate, convert balance, multi-currency | 72 |
| `rate-chart.json` | Exchange | A rate line zig-zags upward across a chart card, the end dot pops and a coin hops on it. | Live exchange rate, best rate, market rate | 80 |
| `globe.json` | Exchange | A globe spins while dollar and euro coins orbit around it on a tilted ring. | Send worldwide, global account, multi-currency | 90 |
| `qr-scan.json` | Payments | Viewfinder brackets lock onto a QR code, a scan line sweeps twice and a check pops. | Scan to pay, QR payments, pay a merchant | 72 |
| `phone-to-phone.json` | Payments | A coin hops in an arc from one phone to another; the receiving phone gets a check. | P2P payments, send to a friend, request money | 72 |
| `instant-bolt.json` | Payments | A lightning bolt strikes down with a squash, shock rings burst and sparks fly. | Instant transfers, arrives in seconds, fast payouts | 48 |
| `calendar-recurring.json` | Payments | A calendar bobs inside spinning repeat arrows; a coin lands on the circled date. | Scheduled / recurring payments, subscriptions, salary day | 90 |
| `chat-bubbles.json` | Support | A question bubble pops in, then the reply bubble answers with bouncing typing dots. | Contact support, live chat, help center | 72 |
| `headset.json` | Support | A support headset bobs and tilts while sound waves pulse from the mic. | Talk to a human, 24/7 support, call us | 64 |
| `id-card.json` | Verification | An ID card gets swept by a scan beam, its lines fill in, and an approval badge pops. | Identity verification (KYC), upload ID, verified account | 80 |
| `envelope-verify.json` | Verification | An envelope flap flips open, a letter with a check pops up, then tucks back in. | Verify email, check your inbox, confirmation sent | 80 |
| `bell.json` | Notifications | A bell swings and rings with its clapper knocking, and a badge pops on top. | Payment alerts, notifications permission, activity | 60 |
| `gift.json` | Rewards | A gift box shakes, its lid pops off, and stars and coins burst out before it closes again. | Invite friends, referral rewards, welcome bonus | 72 |
| `hourglass.json` | Status | Sand pours through an hourglass, then it flips over with a bounce and starts again. | Pending / processing, transfer in progress, verification under review | 90 |
| `gauge.json` | Status | A speedometer needle swings up with a wobble, hovers near the top, then eases back. | Spending limits, account tier, credit/collateral health | 80 |
