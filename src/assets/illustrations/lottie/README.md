# Banking illustrations (Lottie)

Object animations for banking concepts, drawn to the setup mascot's rules
(`src/assets/mascot/lottie/`) but without the mascot. Not wired into any screen yet.

- 1050 × 1000 canvas, 30 fps, seamless loops, transparent background, no fonts or images
- outlines 10.5 / 9 / 7.5, round caps; mascot palette (#FCC814, #E882D0, white, #F2B786, #CC485E, #FFC1CF, #46ACFF)
- authored to be played like `PeanutMascot`: each frame held twice (`MASCOT_HOLD_FRAMES`) at `MASCOT_SPEED`
- before rendering one through `PeanutMascot`, measure its art box the same way `MASCOT_ART_BOXES` is generated

| File | Topic | Animation | Suggested use | Frames |
| --- | --- | --- | --- | --- |
| `mascot-juggle.json` | Rewards | Peanut juggles three star coins with rebuilt arms and a bounce on each catch. Original asset from [PR #3586](https://github.com/peanutprotocol/peanut-ui/pull/3586), commit `a0714bf685b3534a400289a225f6e8a0ab60596a`. | Points hero, referral rewards | 66 |
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
| `money-in.json` | Incoming | Coins drop into a phone one after another; the balance bar on screen grows with each. | Payment received, deposit arrived, balance updated | 72 |
| `mailbox.json` | Incoming | An envelope with a coin seal flies into a mailbox; the box shudders and its flag pops up. | Money received, incoming transfer, request paid | 72 |
| `magnet.json` | Incoming | A horseshoe magnet jiggles as it pulls coins in from the edge of the screen. | Request money, get paid, receive from friends | 72 |
| `send-arc.json` | Outgoing | A coin launches off a phone along a dashed arrow and sails out of frame; the phone recoils. | Send money, transfer sent, pay someone | 64 |
| `rocket.json` | Outgoing | A rocket with a coin in its porthole rumbles upward, puffing exhaust clouds. | Send instantly, fast transfers, launch a payment | 48 |
| `split-pay.json` | Outgoing | A big coin pops and splits into three that hop to three phones, each getting a check. | Split a bill, pay friends, group payments | 80 |
| `alarm-clock.json` | Scheduled | Clock hands whirl forward, the alarm rings and shakes, and a coin pops out on time. | Scheduled transfer, pay on a date, reminders | 80 |
| `calendar-tear.json` | Scheduled | The top page of a desk calendar lifts, tears off and tumbles away, revealing the next payday. | Monthly payments, recurring transfer, salary day | 72 |
| `crypto-token.json` | Crypto | A token coin spins in 3D while a ring of network nodes pings around it. | Crypto balance, stablecoins, on-chain wallet | 72 |
| `blockchain.json` | Crypto | A coin hops along three linked blocks; each block bounces and lights up, then the last one gets a check. | On-chain confirmation, crypto deposit, network status | 80 |
| `crypto-to-bank.json` | Crypto | A token flips into a dollar coin mid-flight as it arcs from a phone into a bank. | Cash out crypto, offramp to bank, convert to dollars | 72 |
| `bank-zipline.json` | Bank transfer | A coin rides a zipline from one bank down to another and lands with a bounce. | Bank transfer, wire, move money between accounts | 64 |
| `bank-pipe.json` | Bank transfer | Coins ride a bendy pipe from a bank into a phone, which bounces as each one arrives. | Deposit from bank, ACH/SEPA top up, link bank account | 72 |
| `currency-flip.json` | Multi-currency | One coin keeps flipping over, showing a new currency on every turn: $, €, £, ¥. | Multi-currency account, hold several currencies, local currency | 80 |
| `converter.json` | Multi-currency | A dollar coin rolls into a little machine; the gears whirr and a euro coin pops out the other side. | Convert currency, exchange at the real rate, FX | 72 |
| `bill-fold-plane.json` | Money planes | A dollar bill floats, folds itself into a paper plane and zips off; a fresh bill pops in. | Send money, transfer sent, “your money is on its way” | 80 |
| `plane-coin-drop.json` | Money planes | A banknote plane flies across and drops coins that tumble into an open wallet below. | Payout received, cashback, money arriving | 80 |
| `plane-skywriting.json` | Money planes | A banknote plane loops through the sky, writing a big dollar sign with its dashed trail. | Earn / get paid, money celebration, welcome | 96 |
| `plane-squadron.json` | Money planes | Three banknote planes fly in a V formation through passing clouds, bobbing out of sync. | Bulk payouts, pay many people, team payments | 64 |
| `plane-delivery.json` | Money planes | A banknote plane swoops down into a phone screen; the phone bounces and a check pops. | Payment delivered, money received, transfer complete | 80 |
| `globe-latam.json` | Money around the world | A globe turned to the Americas while five LATAM currency coins orbit it: $, R$, S/, Bs and Q. | Send across Latin America, local currencies, LATAM coverage | 120 |
| `globe-latam-route.json` | Money around the world | Pins pop up on Mexico, Brazil and Argentina and a coin hops between them, switching to each country’s currency as it lands. | Cross-border LATAM transfers, local payouts, country coverage | 110 |
| `globe-world-route.json` | Money around the world | The LATAM pin route plays, the globe slowly turns to Europe for € and £ stops, then whips back round to Latin America. | Global transfers, LATAM ↔ Europe corridors, send in local currency | 196 |
