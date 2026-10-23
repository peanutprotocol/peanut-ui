import ContentTopicPage, {
    generateMetadata,
    generateStaticParams,
} from '@/app/[locale]/(marketing)/content/[topic]/page'
import { notFound } from 'next/navigation'

jest.mock('./content-topics', () => ({
    isContentTopic: (topic: string) => ['deposit', 'receive', 'send'].includes(topic),
    listContentTopics: () => ['deposit'],
    listContentTopic: (topic: string) =>
        topic === 'deposit'
            ? [{ href: '/en/deposit/from-usd-account', title: 'USD', description: '', lang: 'en' }]
            : [],
}))
jest.mock('next/navigation', () => ({
    notFound: jest.fn(() => {
        throw new Error('NEXT_NOT_FOUND')
    }),
}))

it('does not generate or advertise metadata for empty topic routes', async () => {
    expect(generateStaticParams()).toHaveLength(4)
    expect(generateStaticParams().every(({ topic }) => topic === 'deposit')).toBe(true)
    expect(await generateMetadata({ params: Promise.resolve({ locale: 'en', topic: 'receive' }) })).toEqual({})
    await expect(ContentTopicPage({ params: Promise.resolve({ locale: 'en', topic: 'send' }) })).rejects.toThrow(
        'NEXT_NOT_FOUND'
    )
    expect(notFound).toHaveBeenCalled()
})
