import type { QuizDefinition } from '../types'

// Content grounded in: engineering/analytics/activation/README.md (the Lexicon),
// projects/analytics-cutover/posthog/lexicon-*.sql, projects/card/observability/
// (event glossary + funnel state machine), peanut-ui useActivationStatus, and the
// card-beta email funnel docs. Update there first, here second.
// Question codes ([E1], [M1], [H1]…) match the candidate picker in
// mono/inbox/funnel-quiz-picker/ — keep them in sync until the final cut lands.
export const funnelQuiz: QuizDefinition = {
    slug: 'funnel-quiz',
    title: 'Funnel Fundamentals',
    emoji: '🥜',
    description:
        "Peanut's real funnel + analytics definitions, easy to brutal. The distractors are real, so guessing won't save you.",
    grades: [
        { minFraction: 1, title: 'Certified Funnel Nut 🥜🎓', subtitle: 'You may now correct people in dashboards.' },
        { minFraction: 0.75, title: 'Well-Shelled', subtitle: 'Solid. Retry the missed ones and go flawless.' },
        { minFraction: 0.5, title: 'Half-Cracked', subtitle: 'You know the words. The definitions, less so.' },
        { minFraction: 0.25, title: 'Soggy Shell', subtitle: 'Read the explanations. They are the whole point.' },
        { minFraction: 0, title: 'Raw Peanut', subtitle: 'Everyone starts raw. Hit retry.' },
    ],
    questions: [
        // ————— EASY — the Lexicon, plain definitions —————
        {
            // [E1]
            level: 'easy',
            prompt: 'What is the correct order of the Peanut Lexicon funnel?',
            options: [
                'Visitor → Registered → Verification Started → Verified → Funded → Activated',
                'Visitor → Registered → Verified → Funded → Activated',
                'Visitor → Registered → Verification Started → Funded → Verified → Activated',
                'Visitor → Verification Started → Registered → Verified → Funded → Activated',
            ],
            correctIndex: 0,
            explanation:
                'The Lexicon is our shared vocabulary for the growth funnel: someone visits, registers (creates a passkey), starts verification (opens KYC), gets verified (Sumsub approves), funds (first money in), and activates (first spend). The five-step version without Verification Started is the old one — it hid a huge drop-off inside "Registered → Verified".',
            wrongQuip: 'The Lexicon. Say it with me. All six steps.',
        },
        {
            // [E2]
            level: 'easy',
            prompt: "In the Lexicon, 'Registered' means the user:",
            options: [
                'Completed signup — their passkey was created',
                'Visited the signup page',
                'Verified their email address',
                'Passed KYC',
            ],
            correctIndex: 0,
            explanation:
                "Registered = an account exists (a row in app.users — signup finished, passkey created). Just landing on /setup keeps you a Visitor; KYC is the next step ('Verified').",
        },
        {
            // [E3]
            level: 'easy',
            prompt: "'Verified' means the user:",
            options: [
                'Had KYC approved by Sumsub',
                'Had KYC approved by any of our providers — Bridge, Manteca, or Sumsub',
                'Confirmed their phone number',
                'Was manually approved by support',
            ],
            correctIndex: 0,
            explanation:
                'Verified = Sumsub approved the KYC. Specifically Sumsub. The any-provider version (Bridge, Manteca, or Sumsub) is the OLD definition — retired. Upstream of it sits Verification Started: the user opened KYC, measured in PostHog as kyc_initiated ∪ manteca_kyc_initiated.',
            wrongQuip: 'One provider counts. Sumsub.',
        },
        {
            // [E4]
            level: 'easy',
            prompt: "'Funded' — the deposit step — means the user:",
            options: [
                'Completed at least one inflow: an onramp, a claimed send link, or a crypto deposit',
                'Linked a funding source like a bank account',
                'Holds a balance of at least $10',
                'Made their first card payment',
            ],
            correctIndex: 0,
            explanation:
                'Funded = money actually arrived at least once: a fiat ONRAMP, a claimed send link (SEND_LINK_CLAIM), or an on-chain CRYPTO_DEPOSIT — status COMPLETED. Linking a bank moves no money; a card payment is a spend (that is Activated).',
            wrongQuip: 'Funded = money IN. Actually in.',
        },
        {
            // [E5]
            level: 'easy',
            prompt: "'Activated' — our north-star step — means the user:",
            options: [
                'Completed at least one SPEND — a card spend, or a QR spend on Mercado Pago / Pix',
                'Completed at least one outbound transaction — a send link, offramp, withdrawal, or payment',
                'Deposited money for the first time',
                'Finished signup and KYC',
            ],
            correctIndex: 0,
            explanation:
                'Activated = at least one spend: card spend, or QR spend on Mercado Pago / Pix. That is the whole list. The "any money OUT" version (send links, offramps, direct sends, request-pays, crypto withdrawals) is the OLD definition — those still count as Volume, but moving money out is not the value moment. Spending it is.',
            wrongQuip: 'Money in is Funded. A SPEND is Activated. Everything else out is just Volume.',
        },
        {
            // [E6]
            level: 'easy',
            prompt: "A funnel step's 'conversion rate' is:",
            options: [
                'The share of users who entered the step and completed it',
                'The share of all our users who ever completed the step',
                'The number of users who completed the step this week',
                'Completed steps divided by sessions',
            ],
            correctIndex: 0,
            explanation:
                'Conversion = completed ÷ entered, for the same group of users. The denominator is who ENTERED the step — not all users, not sessions. Get the denominator wrong and every number downstream is fiction.',
        },
        // ————— MID — how the steps are actually measured —————
        {
            // [M1]
            level: 'mid',
            prompt: 'Which of these does NOT count toward Funded?',
            options: [
                'Receiving Peanut points or a reward payout',
                'A completed fiat onramp',
                'Claiming a send link from a friend',
                'An on-chain USDC deposit to your wallet',
            ],
            correctIndex: 0,
            explanation:
                'Rewards and points are explicitly excluded from the Funded definition — they are us moving money, not the user. The three real inflows are ONRAMP, SEND_LINK_CLAIM, and CRYPTO_DEPOSIT, each with status COMPLETED.',
            wrongQuip: 'We can’t "fund" you into activation ourselves.',
        },
        {
            // [M2]
            level: 'mid',
            prompt: "'Active' — as on DAU/WAU-style dashboards — means a user who:",
            options: [
                'Completed at least one transaction in the last 7 days',
                'Opened the app in the last 7 days',
                'Completed at least one transaction in the last 28 days',
                'Ever reached Activated',
            ],
            correctIndex: 0,
            explanation:
                "Active = ≥1 COMPLETED transaction in the last 7 days. Opening the app is a session, not activity, and Activated is a lifetime milestone, not a state. The opposite of Active is Inactive — 'churned' and 'dormant' are banned words: they dress a 7-day observation up as a prediction.",
            wrongQuip: 'Not churned. Not dormant. Inactive.',
        },
        {
            // [M3]
            level: 'mid',
            prompt: 'A user passed KYC but has zero balance. Which activation step does the home screen show them?',
            options: [
                "Deposit — 'Add money to make your first payment'",
                "Verify — 'Unlock payments'",
                "Spend — 'Make your first payment'",
                'None — the CTAs disappear after KYC',
            ],
            correctIndex: 0,
            explanation:
                'The in-app activation flow is verify → deposit → (card) → spend. KYC done + no balance lands you on the deposit step, routing to /add-money. You cannot make a first spend with an empty wallet, so the spend step waits until there is balance.',
        },
        {
            // [M4]
            level: 'mid',
            prompt: "In Peanut card metrics, 'tokenization' means:",
            options: [
                'The card is added to Apple/Google wallet',
                'A virtual card number is generated',
                'The KYC provider issues a session token',
                'USDC is converted to a spendable balance',
            ],
            correctIndex: 0,
            explanation:
                'Tokenization = the add-to-wallet step (tracked from card_add_to_wallet_viewed onward). A card can be issued and never tokenized — that user can never tap to pay, which is why issued→tokenized is its own funnel step and its own class of drop-off.',
            wrongQuip: 'Not a crypto thing. A wallet thing.',
        },
        {
            // [M5]
            level: 'mid',
            prompt: "'First spend' fires on card_spend_authorized, not card_spend_settled. What's the actual difference?",
            options: [
                'Authorization is the merchant hold at tap time; settlement is when funds actually clear, often days later',
                'Authorization is our app approving the spend; settlement is the user confirming it',
                'They are synonyms from two different providers',
                'Settlement always happens first, authorization confirms it',
            ],
            correctIndex: 0,
            explanation:
                'card_spend_authorized = the moment the user tapped and the merchant got a hold — the behavioral event. card_spend_settled = money actually moving, days later. Between them a spend can also become declined or reversed. Use authorized for behavior, settled for money.',
        },
        {
            // [M6]
            level: 'mid',
            prompt: "A dashboard says 'cards issued: 371'. Which event is it counting?",
            options: [
                'card_apply_card_created',
                'card_apply_succeeded',
                "card_state_viewed with state='active'",
                'card_spend_authorized',
            ],
            correctIndex: 0,
            explanation:
                "card_apply_card_created is THE 'card issued' event — Rain actually created the card. card_apply_succeeded only means the application was submitted; the card doesn't exist yet. state='active' is a screen view, which double-counts every visit.",
            wrongQuip: "'apply_succeeded' is the classic trap. Application ≠ card.",
        },
        {
            // [M7]
            level: 'mid',
            prompt: 'A user signs up, passes KYC, gets a card — and never spends. Which stage of the growth funnel failed?',
            options: ['Activation', 'Acquisition', 'Retention', 'Referral'],
            correctIndex: 0,
            explanation:
                "Acquisition got them in the door; activation = reaching the first moment of real value — a first spend. You can't retain a user who never activated: retention only starts counting after the first value moment.",
            wrongQuip: 'Retention only starts after the first value moment.',
        },
        // ————— HARD — the traps we actually fall into —————
        {
            // [H1]
            level: 'hard',
            prompt: 'For card spend counting toward Activated, the qualifying event is the AUTHORIZATION, not the settlement (CLEAR). Why?',
            options: [
                'The authorization is the moment the user actually tapped and got value; settlement is bookkeeping that lands days later',
                'Settlements are not stored in the database',
                'The canonical definition counts CLEAR — settlement is when money actually moves',
                'Authorizations exclude declined transactions',
            ],
            correctIndex: 0,
            explanation:
                'Ruling: the qualifying card event for Activated is the AUTHORIZATION — the tap is the value moment, and it is when the user behaved. Settlement (CLEAR) is the money actually moving, often days later — use it for money reporting, never for activation. Counting CLEAR is the OLD convention; picking it here is exactly the drift our scoreboard scripts used to suffer from, just in the other direction.',
            wrongQuip: 'The tap is the moment. Settlement is bookkeeping.',
        },
        {
            // [H2]
            level: 'hard',
            prompt: 'A user claims a $20 send link, then sends half of it onward as a send link to a friend. In Lexicon terms they are:',
            options: [
                'Funded but not Activated',
                'Activated — the outbound send link was a completed transaction',
                'Only Registered — send links are excluded from the funnel',
                'Verified — claiming requires KYC',
            ],
            correctIndex: 0,
            explanation:
                'The claim (SEND_LINK_CLAIM) made them Funded — money came IN. But Activated requires a SPEND: card spend or QR spend on Mercado Pago / Pix. An outbound send link is Volume, not activation — that is the OLD "any money out" definition talking. This user is exactly who the Funded→Activated cliff is about: money in, money shuffled, nothing spent.',
            wrongQuip: 'Passing money along is not spending it.',
        },
        {
            // [H3]
            level: 'hard',
            prompt: "500 cards were issued this month and 250 first-spends happened this month. A teammate reports 'issued→first-spend is 50%'. What's wrong?",
            options: [
                "The 250 spenders aren't necessarily from the 500 issued — conversion must follow one cohort through both steps",
                'Nothing, that is how funnel conversion is defined',
                'They should have used settled spends instead',
                'The denominator should be all users, not issued cards',
            ],
            correctIndex: 0,
            explanation:
                "Funnel conversion = of the users who did step A in a cohort, how many later did step B. This month's spenders mostly got their cards in earlier months. Dividing this month's B by this month's A mixes cohorts and can even exceed 100%.",
            wrongQuip: 'Cohorts. Always cohorts.',
        },
        {
            // [H4]
            level: 'hard',
            prompt: "We report email results 'matured' (e.g. 65.6% open after a week) instead of day-1 numbers. Why?",
            options: [
                'People act slowly — a metric read too early undercounts, and cohorts become comparable only after the action window closes',
                'Email providers batch-report stats weekly',
                'It averages out weekend effects',
                'Day-1 numbers are inflated by bots',
            ],
            correctIndex: 0,
            explanation:
                "A 'matured' metric is read after enough time has passed for slow actors to act. Day-1 vs day-7 open rates differ hugely, so comparing a fresh campaign's day-1 number against an old campaign's final number is comparing different things.",
        },
        {
            // [H5]
            level: 'hard',
            prompt: 'Why do we treat email CLICK rate as trustworthy but open rate as decoration?',
            options: [
                'Apple Mail privacy protection auto-loads tracking pixels, inflating opens; a click requires a human finger',
                'Opens are sampled, clicks are counted exactly',
                'Open tracking is disabled in our sender',
                'Clicks include opens by definition',
            ],
            correctIndex: 0,
            explanation:
                'Apple MPP (and other prefetchers) fetch the tracking pixel whether or not a human read the email, so open rate is inflated by an unknowable amount. Clicks are deliberate actions. Rank campaigns by clicks; use opens only directionally.',
        },
        {
            // [H6]
            level: 'hard',
            prompt: 'Time-to-first-spend: mean 4.2 days, median 11 hours. What should you conclude?',
            options: [
                'The typical user spends within a day; a long tail of slow users drags the mean up',
                'The data is corrupted — they should match',
                'Users are getting slower over time',
                'The typical user takes about 4 days to spend',
            ],
            correctIndex: 0,
            explanation:
                "When mean >> median, a long right tail is doing the damage. The median is the typical user (11h!); the mean is distorted by a few week-long stragglers. Report medians for 'typical', and look at the tail as its own segment.",
            wrongQuip: 'The mean lies when the tail wags.',
        },
        {
            // [H7]
            level: 'hard',
            prompt: 'A user got a card issued but never opened the add-to-wallet screen. For the tokenization step, this user is:',
            options: ['Never-reached', 'Stalled', 'Inactive', 'Converted with delay'],
            correctIndex: 0,
            explanation:
                "Never-reached = the user never arrived at the step. Stalled = they arrived (opened the screen) but didn't complete it. The fix differs completely: never-reached is a discovery/comms problem, stalled is a UX/product problem. Merging them hides which one you have.",
            wrongQuip: "Can't stall on a screen you never opened.",
        },
    ],
}
