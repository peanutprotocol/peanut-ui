# SEO TODOs

## Content Tasks (Marketer)

### Convert Pages — Editorial Content
Each `/convert/{pair}` page needs 300+ words of unique editorial content to avoid thin content flags.
Include: currency background, exchange rate trends, tips for getting best rates, common use cases.
Reference: Wise convert pages for structure and depth.

### Blog — Seed Posts
Write 10-15 seed posts targeting hub topics:
- One per major country (Argentina, Brazil, Mexico)
- Cross-cutting guides ("cheapest way to send money internationally", "crypto vs wire transfer")
- Use `peanut-content/reference/agent-workflow.md` as the generation playbook.

### Payment Method Pages
Expand `/pay-with/{method}` content for each payment method.
Current placeholder content is thin. Each needs 500+ words.

### Team Page
Fill in real team member data in `src/data/team.ts`:
- Real names, roles, bios
- Headshots (400x400px WebP in /public/team/)
- Social links (LinkedIn especially — builds E-E-A-T)

## Engineering Tasks

### Scroll-Depth CTAs
TODO: Add mid-content CTA cards on long editorial pages (blog posts, corridor pages).
Trigger: Insert CTA after 50% scroll or after the 3rd section.
Design: Use Bruddle Card with `variant="purple"` Button.
Purpose: Increase conversion from organic traffic on content-heavy pages.

### Sitemap Submission on Deploy
Add to Vercel build hook or post-deploy script:
```bash
curl "https://www.google.com/ping?sitemap=https://peanut.me/sitemap.xml"
curl "https://www.bing.com/ping?sitemap=https://peanut.me/sitemap.xml"
```
Or use Google Search Console API for programmatic submission.

### Help Center (Crisp)
DNS only — add CNAME record:
```
help.peanut.me → [crisp-kb-domain]
```
Configure in Crisp Dashboard > Settings > Knowledge Base > Custom Domain.

### Content Generation CI
Set up a script/CI job that runs Konrad's agent workflow to generate/update content files.
See `peanut-content/reference/agent-workflow.md`.
