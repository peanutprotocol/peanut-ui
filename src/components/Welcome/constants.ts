import * as assets from '@/assets'

function classNames(...classes: any) {
    return classes.filter(Boolean).join(' ')
}

const logoCloudLogos = [
    { icon: assets.WALLETCONNECT_LOGO, link: 'https://walletconnect.com/' },
    { icon: assets.CLAVE_LOGO, link: 'https://www.getclave.io/', classNameImg: 'rounded-full' },
    { icon: assets.ECO_LOGO, link: 'https://eco.org/?ref=com' },
    { icon: assets.MANTLE_ICON, link: 'https://www.mantle.xyz/' },
    {
        icon: assets.BLOCKSCOUT_LOGO,
        link: 'https://www.blockscout.com/',
        className: 'bg-black',
        classNameImg: 'rounded-full',
    },
    {
        icon: assets.HYPERSPHERE_LOGO_SQUARE,
        link: 'https://www.hypersphere.ventures/',
        classNameImg: 'rounded-full',
    },
    {
        icon: assets.ZEEPRIME_LOGO_SQUARE,
        link: 'https://zeeprime.capital/',
        className: ' bg-white rounded-full ',
        classNameImg: 'h-6 w-6 sm:h-12 sm:w-12 -mt-[4px]',
    },
    {
        icon: assets.LONGHASH_LOGO_SQUARE,
        link: 'https://www.longhash.vc/',
        className: 'p-0 bg-white',
        classNameImg: 'h-6 w-6 sm:h-12 sm:w-12 rounded-lg',
    },
    {
        icon: assets.NAZARE_LOGO_SQUARE,
        link: 'https://www.nazare.io/',
        classNameImg: 'rounded-full',
    },
]

const faqs = [
    { question: 'How can I try?', answer: 'Check out our dapp or any of the projects that already integrated Peanut.' },
    {
        question: 'What are the trust assumptions?',
        answer: 'Peanut Protocol is non-custodial, permissionless and decentralised. Read more ',
        redirectUrl: 'https://docs.peanut.to/overview/what-are-links/trust-assumptions',
        redirectText: 'here.',
    },
    {
        question: 'What happens if I want to cancel or if I lose the link?',
        answer: 'The only thing you need is the transaction hash! To see how, click ',
        redirectUrl: 'https://peanut.to/refund',
        redirectText: 'here.',
    },
    {
        question: 'What are the fees?',
        answer: 'On our dapp, we sponsor gasless claiming and sending on L2s. Integrators can choose to sponsor the transactions. We do not have a fee on the protocol for same-chain transactions, see ',
        redirectUrl: 'https://docs.peanut.to/overview/pricing',
        redirectText: 'here.',
    },
    {
        question: 'I need help!',
        answer: 'Sure! Let us know at hello@peanut.to or on ',
        redirectUrl: 'https://discord.gg/uWFQdJHZ6j',
        redirectText: 'discord.',
    },
    {
        question: 'Are you audited?',
        answer: 'Yes! ',
        redirectUrl: 'https://docs.peanut.to/other/security-audit',
        redirectText: 'See our docs for more',
    },
    {
        question: 'I want this for our app! How long does it take to integrate?',
        answer: 'Our record integration took 2 hours, but it depends on your stack. ',
        calModal: true,
        redirectText: 'Lets talk!',
    },
]
const testimonials = [
    {
        imageSrc: assets.DEREK_PERSON.src,
        altText: 'picture of chad',
        comment: 'How did this not exist before?! Great UX!',
        name: 'Derek Rein',
        detail: 'WalletConnect',
        detailRedirectUrl: 'https://walletconnect.com/',
        bgColorClass: 'bg-white',
    },
    {
        imageSrc: assets.SHARUK_PERSON.src,
        altText: 'eco man',
        comment: 'Peanut allows us to elegantly solve the cold start problem!',
        name: 'shahrukh Rao',
        detail: 'Eco',
        detailRedirectUrl: 'https://eco.org/?ref=com',
        bgColorClass: 'bg-white',
    },
    {
        imageSrc: assets.KOFIME_PERSON.src,
        altText: 'kofi',
        comment: 'Very buttery experience!',
        name: 'Kofi.me',
        detail: 'Kofi.me',
        detailRedirectUrl: 'https://www.kofime.xyz/',
        bgColorClass: 'bg-white',
    },
    {
        imageSrc: assets.SBF_PERSON.src,
        altText: 'picture of pixel art SBF',
        comment: 'I have a peanut allergy. Help!',
        name: 'CEx CEO',
        detail: 'Probably FTX',
        bgColorClass: 'bg-white',
    },
]

export { logoCloudLogos, faqs, testimonials, classNames }
