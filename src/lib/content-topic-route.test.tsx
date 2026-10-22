import BlogSlugPage, { generateMetadata, generateStaticParams } from '@/app/[locale]/(marketing)/blog/[slug]/page'
import { notFound } from 'next/navigation'

// The hub topics share /{locale}/blog/[slug] with the posts (the former
// /{locale}/content/[topic] address 308s here). No posts in this test, so
// every generated param is a topic.
jest.mock('./blog', () => ({
    getAllPosts: () => [],
    getPostBySlug: async () => null,
}))
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
    const params = await generateStaticParams()
    expect(params).toHaveLength(4)
    expect(params.every(({ slug }) => slug === 'deposit')).toBe(true)
    expect(await generateMetadata({ params: Promise.resolve({ locale: 'en', slug: 'receive' }) })).toEqual({})
    await expect(BlogSlugPage({ params: Promise.resolve({ locale: 'en', slug: 'send' }) })).rejects.toThrow(
        'NEXT_NOT_FOUND'
    )
    expect(notFound).toHaveBeenCalled()
})
