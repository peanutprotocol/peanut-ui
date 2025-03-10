Hello @hugomont I went through the code and try to answer as much as possible to your bullet points. I wasn't able to serve or build the app, it seems I'm missing some env variables, so I wasn't able to me more precise in my hypothesis.
If you want me to dig deeper into it, the best would be for me to discuss with your frontend dev directly, so we can work on specific issues & components.

State management:
- Use URL search params when possible
- Use context for shared state
- Avoid props drilling when possible
- Try not to store objects in state 
- I would not recommend using Redux, it's an old solution (pre-context) that most of the company try to get rid of

Best practices with component:
- I would recommend to create more pages & subpages (with layout)
- Avoid creating component inside component (ex: GlobalLinkAccount has a renderComponent function)

Slow compile times when developing locally:
- Some thought: too much code is executing on the server that shouldn't.
- Splitting the code and deps, lazy loading some chunks might reduce it.

Large components that sometimes contain both ui and biz logic:
- For me it's not too big of an issue. Maybe we can go through some specific component and see how we can split it

Low clientside load times, bad web vitals:
- Use as much as possible tree shakable libraries (ex: framer-motion -> import { m } instead of import { motion })
- Dynamically import some libraries to lazy load them, I'm sure metamask-sdk has a heavy impact
- Try to remove libraries that you're using only a little (ex: axios, ethers)
- Use <Suspense> to lazy load libraries and content
- Prerender the pages (important)
- Use next caching
- Remove blocking CSS
- img: set width/height, set loading attribute
- Serve token logo from your server (public folder)
- Use <link rel="preconnect" href="" /> to external resources
- Remove unused code & import, it might impact your bundle size for nothing

State persistence across refresh:
- By using URL search params and subpages you'll get persistence by default
- For complexe data (list of items) store it in localstorage

bruddle/style/color management:
- Try to stick to one component library (ex: chakra-ui-step is adding a bunch of config into CSS for one component)
- I would need to discuss with the frontend dev to better understand the problem and situation

Bonus: 
- Remove unused libraries (ex: sharp, react-lottie, i18next, ...)
- Do not put a <button> inside a <Link>, it creates a double focus element
- Use <label> only in association with an <input>, <textarea> or <select>
- Set yourself some rules for spacing and stick to it. For example I do only 4px, 8px, 16px, 24px, 32px & 40px.

---
Hugo Montenegro | Peanut 🥜, [2/3/25 4:16 PM]
@gd_schtroumpf hi! A few Qs:

1. re: redux, would you recommend just using react context for state then?

2. "I would recommend to create more pages & subpages (with layout)" - could you expand on this one?

Grandschtroumpf, [2/3/25 4:32 PM]
Hello :)
1. It depends, 
- for form state: Search params in the URL
- for backend data: ReactQuery is good (https://tanstack.com/query/latest)
- for global state that doesn't update often: Context
- for the rest: regular useState should do the trick

2. I don't have the code in mind but I tend to split the UI components from the pages. Using pages and sub pages in combination with search params, you'll have an easy time keeping the state on reload, tracking progress, and avoid props drilling. 
For example if I send you this link you'll have a form prefilled
https://app.carbondefi.xyz/trade/overlapping?base=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&quote=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&anchor=sell&budget=%2210%22

Grandschtroumpf, [2/3/25 4:43 PM]
In the example I have different type of chart and forms depending on the type of strategy so I created one subpage per type of strategy.
The state of the is totally stored in the URL and everything is derived from it and some external endpoint (for the prices in the chart for example).
Since the URL is accessible from everywhere I do not need to do some props drilling to get it or update itHugo Montenegro | Peanut 🥜, [2/4/25 8:45 PM]
yeah makes sense. Is the code for this page open source? would love to check it out

Grandschtroumpf, [2/4/25 9:13 PM]
Yes it is open source. We can organize a call if you want, I can show you my thought process when I did it.

Grandschtroumpf, [2/4/25 9:14 PM]
This is one of the page component:
https://github.com/bancorprotocol/carbon-app/blob/main/src%2Fpages%2Ftrade%2Fdisposable.tsx