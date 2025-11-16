'use client'

import Layout from '@/components/Global/Layout'
import {
    DropLink,
    FAQs,
    Marquee,
    NoFees,
    SecurityBuiltIn,
    SendInSeconds,
    YourMoney,
    RegulatedRails,
} from '@/components/LandingPage'
import Footer from '@/components/LandingPage/Footer'
import Manteca from '@/components/LandingPage/Manteca'
import { QuestsHero } from './components/QuestsHero'

export default function QuestsPage() {
    const marqueeProps = {
        visible: true,
        message: ['QUESTS', 'LEADERBOARDS', 'WIN $1500', 'DEVCONNECT', 'COMPETE', 'EARN BADGES'],
    }

    const faqs = {
        heading: 'Faqs',
        questions: [
            {
                id: '0',
                question: 'What are Peanut Quests?',
                answer: `Peanut Quests are fun challenges where you can compete with other users to climb the leaderboard and win prizes!`,
            },
            {
                id: '1',
                question: 'How do I participate?',
                answer: 'Simply sign up for Peanut and start using the app! Your activities automatically count towards various quests.',
            },
            {
                id: '2',
                question: 'What can I win?',
                answer: 'The top scorer during DevConnect can win up to $1500! Plus, earn exclusive badges to show off your achievements.',
            },
            {
                id: '3',
                question: 'When does the competition end?',
                answer: 'The DevConnect quest competition runs throughout the event. Check the leaderboards regularly to see your ranking!',
            },
        ],
        marquee: {
            visible: false,
            message: 'Peanut',
        },
    }

    return (
        <Layout className="enable-select !m-0 w-full !p-0">
            <QuestsHero />
            <Marquee {...marqueeProps} />
            <DropLink />
            <Marquee {...marqueeProps} />
            <RegulatedRails />
            <Marquee {...marqueeProps} />
            <YourMoney />
            <Marquee {...marqueeProps} />
            <Manteca />
            <Marquee {...marqueeProps} />
            <SecurityBuiltIn />
            <Marquee {...marqueeProps} />
            <SendInSeconds />
            <Marquee {...marqueeProps} />
            <NoFees />
            <Marquee {...marqueeProps} />
            <FAQs heading={faqs.heading} questions={faqs.questions} marquee={faqs.marquee} />
            <Marquee {...marqueeProps} />
            <Footer />
        </Layout>
    )
}
