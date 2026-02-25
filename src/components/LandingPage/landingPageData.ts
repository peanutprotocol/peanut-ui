export const heroConfig = {
    primaryCta: {
        label: 'SIGN UP',
        href: '/setup',
        subtext: 'currently in waitlist',
    },
}

export const marqueeMessages = ['No fees', 'Instant', '24/7', 'USD', 'EUR', 'USDT/USDC', 'GLOBAL', 'SELF-CUSTODIAL']

export const faqData = {
    heading: 'Faqs',
    questions: [
        {
            id: '0',
            question: 'Why Peanut?',
            answer: `It's time to take control of your money. No banks, no borders. Just buttery smooth global money.`,
        },
        {
            id: '1',
            question: 'What is Peanut?',
            answer: `Peanut is the easiest way to send digital dollars to anyone anywhere. Peanut's tech is powered by cutting-edge cryptography and the security of biometric user authentication as well as a network of modern and fully licensed banking providers.`,
        },
        {
            id: '2',
            question: 'Do I have to KYC?',
            answer: `No! You can use core functionalities (like sending and receiving money) without KYC. Bank connections, however, trigger a one\u2011time check handled by Persona, a SOC2 Type 2 certified and GDPR compliant ISO 27001\u2013certified provider used by brands like Square and Robinhood. Your documents remain locked away with Persona, not Peanut, and Peanut only gets a yes/no response, keeping your privacy intact.`,
        },
        {
            id: '3',
            question: 'Could a thief drain my wallet if they stole my phone?',
            answer: `Not without your face or fingerprint. The passkey is sealed in the Secure Enclave of your phone and never exported. It\u2019s secured by NIST\u2011recommended P\u2011256 Elliptic Curve cryptography. Defeating that would be tougher than guessing all 10\u00B9\u2070\u00B9\u2070 combinations of a 30\u2011character password made of emoji.\nThis means that neither Peanut or even regulators could freeze, us or you to hand over your account, because we can\u2019t hand over what we don\u2019t have. Your key never touches our servers; compliance requests only see cryptographic and encrypted signatures. Cracking those signatures would demand more energy than the Sun outputs in a full century.`,
        },
        {
            id: '4',
            question: `What happens to my funds if Peanut\u2019s servers were breached?`,
            answer: "Nothing. Your funds sit in your self\u2011custodied smart account (not on Peanut servers). Every transfer still needs a signature from your biometric passkey, so a server\u2011side attacker has no way to move a cent without the private key sealed in your device's Secure Enclave. Even if Peanut were offline, you could point any ERC\u20114337\u2011compatible wallet at your smart account and recover access independently.",
        },
        {
            id: '5',
            question: 'How does Peanut make money?',
            answer: 'We plan to charge merchants for accepting Peanut as a payment method, whilst still being much cheaper than VISA and Mastercard. For users, we only charge minimal amounts!',
        },
        {
            id: '6',
            question: 'My question is not here',
            answer: 'Check out our full FAQ page at https://peanutprotocol.notion.site/FAQ-2a4838117579805dad62ff47c9d2eb7a or visit our support page at https://peanut.me/support for more help.',
        },
    ],
    marquee: {
        visible: false,
        message: 'Peanut',
    },
}
