// import * as global_components from '@/components/global'
// import smiley from '@/assets/smiley.svg'
// import peanutman_happy from '@/assets/peanutman-happy.svg'

// export function Welcome() {
//     return (
//         <div className="mt-0 flex h-full min-h-[100vh] flex-col  ">
//             {/* Hero in columns */}
//             <section className="text-black  lg:divide-y" id="hero">
//                 <div className="relative mx-auto">
//                     <div className="border-2 border-black lg:grid lg:grid-flow-col-dense lg:grid-cols-2 ">
//                         {/* left column */}
//                         <div className="brutalborder bg-yellow py-16 text-center sm:px-6 lg:mx-0 lg:max-w-none lg:px-0">
//                             <h1 className="mx-auto my-8 w-3/4 text-5xl font-black">Send Tokens Easily</h1>
//                             <div className="m-4 mx-auto w-3/4 p-2 text-xl">
//                                 Lorem ipsum dolor sit amet, consectetur adipisicing elit. Iusto dicta qui ullam dolores,
//                                 culpa amet porro eos dignissimos deleniti minus quos possimus nemo dolorem quaerat
//                                 asperiores ut sunt consequuntur temporibus?
//                             </div>

//                             <div className="mt-8 flex justify-center space-x-4 p-2">
//                                 <a
//                                     href="/"
//                                     id="cta-btn"
//                                     className="mb-2 block bg-white p-5 text-2xl font-black md:w-3/5 lg:w-1/3"
//                                 >
//                                     Try Now
//                                 </a>

//                                 <a
//                                     href="https://peanut.to/docs"
//                                     target="_blank"
//                                     rel="noopener noreferrer"
//                                     className="p-5 text-2xl font-black text-black hover:underline"
//                                 >
//                                     Integrate →
//                                 </a>
//                             </div>
//                         </div>

//                         {/* right column */}
//                         <div className="center-xy brutalborder relative overflow-hidden  border-2 border-black bg-fuchsia py-3 lg:border-l-0 lg:pb-16 lg:pt-32">
//                             <img
//                                 src={peanutman_happy.src}
//                                 className="absolute top-10 duration-200 hover:rotate-12"
//                                 alt="Peanutman Cheering"
//                             />
//                         </div>
//                     </div>
//                 </div>
//             </section>

//             {/* seperator */}
//             <global_components.MarqueeWrapper backgroundColor="bg-black">
//                 <>
//                     <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide md:py-4 md:text-4xl">
//                         GO
//                     </div>
//                     <img src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
//                     <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide md:py-4 md:text-4xl">
//                         NUTS
//                     </div>
//                     <img src={smiley.src} alt="logo" className="mr-1 h-5 md:h-8" />
//                 </>
//             </global_components.MarqueeWrapper>

//             {/* Features */}

//             <section id="features">
//                 <div role="list" className="grid grid-cols-1 gap-0 text-black sm:grid-cols-2 lg:grid-cols-3">
//                     {/* QR Codes / URLs */}
//                     <div
//                         className="brutalborder flex flex-col border-2 border-black bg-teal p-12 px-16 lg:border-r-0"
//                         id="QR"
//                     >
//                         <h3 className="text-5xl font-black">QR Codes / URLs</h3>
//                         <p className="mt-1 block text-2xl leading-loose">
//                             Reward prospective and existing community members with tokens. Just send them a URL or
//                             display a QR code on any medium you like. You'll be able to see who and how many have been
//                             claimed.
//                         </p>
//                         <div className="flex-grow"></div>
//                         <div className="center-xy flex-end my-6 flex justify-around">
//                             <a href="/campaigns">
//                                 <button className="brutalborder brutalshadow p-4 px-4 text-2xl font-black hover:invert">
//                                     Start Now
//                                 </button>
//                             </a>

//                             <div className="ml-4 p-5 text-2xl font-normal hover:underline border-none bg-none ">Testimonial →</div>

//                         </div>
//                     </div>
//                     {/* Email */}
//                     <div
//                         className="brutalborder flex flex-col border-2 border-black bg-red p-12 px-16 lg:border-r-0"
//                         id="email"
//                     >
//                         <h3 className="text-5xl font-black">Email</h3>
//                         <p className="mt-1 block text-2xl leading-loose">
//                             Got an email list? Send tokens to your audience and convert them easily to users. Simply
//                             grab a CSV and plug the links to your next mergmail newsletter.
//                         </p>
//                         <div className="flex-grow"></div>
//                         <div className="center-xy flex-end my-6 flex justify-around">
//                             <a href="/campaigns">
//                                 <button className="brutalborder brutalshadow p-4 px-4 text-2xl font-black hover:invert">
//                                     Start Now
//                                 </button>
//                             </a>

//                                 <div className="ml-4 p-5 text-2xl font-normal hover:underline border-none bg-none ">Testimonial →</div>
//                         </div>
//                     </div>
//                     {/* Physical */}
//                     <div
//                         className="brutalborder flex flex-col border-2 border-black bg-lightblue p-12 px-16"
//                         id="physical"
//                     >
//                         <h3 className="text-5xl font-black">Get Physical</h3>
//                         <p className="mt-1 block text-2xl leading-loose">
//                             Are you planning an IRL event? Boost the conversion of swag and booths 20X. Get users on the
//                             spot, just put stickers on your swag or flyers. Become irresistible.
//                         </p>
//                         <div className="flex-grow"></div>
//                         <div className="center-xy flex-end my-6 flex justify-around">
//                             <a href="/campaigns">
//                                 <button className="brutalborder brutalshadow p-4 px-4 text-2xl font-black hover:invert">
//                                     Start Now
//                                 </button>
//                             </a>

//                             <div className="ml-4 p-5 text-2xl font-normal hover:underline border-none bg-none ">Testimonial →</div>

//                         </div>
//                     </div>
//                 </div>
//             </section>

//             {/* seperator */}
//             <global_components.MarqueeWrapper backgroundColor="bg-black">
//                 <>
//                     <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide md:py-4 md:text-4xl">
//                         GO
//                     </div>
//                     <img src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
//                     <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide md:py-4 md:text-4xl">
//                         NUTS
//                     </div>
//                     <img src={smiley.src} alt="logo" className="mr-1 h-5 md:h-8" />
//                 </>
//             </global_components.MarqueeWrapper>

//             {/* Explainer Section */}
//             <section className="lg:divide-y" id="explainer">
//                 <div className="brutalborder relative mx-auto text-black">
//                     <div className="lg:grid lg:grid-flow-col-dense lg:grid-cols-2">
//                         {/* Left column */}
//                         <div className="center-xy relative overflow-hidden border-2 border-black bg-fuchsia py-3 lg:border-l-0 lg:pb-16 lg:pt-32">
//                             <img
//                                 src={peanutman_happy.src}
//                                 className="absolute top-10 duration-200 hover:rotate-12"
//                                 alt="Peanutman Cheering"
//                             />
//                             <div></div>
//                         </div>

//                         {/* Right column */}
//                         <div className="brutalborder bg-yellow text-center sm:px-6 lg:mx-0 lg:max-w-none lg:px-0 lg:py-16">
//                             <div className="text-center">
//                                 <ul className="inline-block p-8 text-left text-xl lg:px-32 lg:leading-loose">
//                                     <p className="text-3xl font-black">Your Voice</p>
//                                     <li>
//                                         Customize token and claim page to match your branding with logo and colors. Or
//                                         even better, have the users claim the tokens on your own page!
//                                     </li>
//                                     <p className="text-3xl font-black">Noob-friendly</p>
//                                     <li>Guided wallet setup for first-time crypto users, no advance address needed!</li>
//                                     <p className="text-3xl font-black">Analytics</p>
//                                     <li>Understand how your campaign went and who your community is.</li>
//                                     <p className="text-3xl font-black">Non-custodial</p>
//                                     <li>
//                                         This is run on Peanut Protocol which is non-custodial and composable (see our{' '}
//                                         <a
//                                             href="https://peanutprotocol.notion.site/Send-Crypto-via-Link-SDK-9a89ea726b754a1c9f7e012125a01a85"
//                                             className="text-bold underline"
//                                             target="_blank"
//                                             rel="noopener noreferrer"
//                                         >
//                                             SDK
//                                         </a>
//                                         )
//                                     </li>
//                                 </ul>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             </section>

//             {/* seperator */}
//             <global_components.MarqueeWrapper backgroundColor="bg-black">
//                 <>
//                     <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide md:py-4 md:text-4xl">
//                         GO
//                     </div>
//                     <img src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
//                     <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide md:py-4 md:text-4xl">
//                         NUTS
//                     </div>
//                     <img src={smiley.src} alt="logo" className="mr-1 h-5 md:h-8" />
//                 </>
//             </global_components.MarqueeWrapper>

//             {/* customise */}
//             <section className="h-full w-full bg-white py-12 text-black">
//                 <div className="center-xy mx-auto flex w-11/12 items-center bg-white lg:w-3/5">
//                     <div className="text-center">
//                         <h2 className="title-font text-3xl font-black text-black lg:text-7xl">Make your own</h2>

//                         <div className="mx-auto w-4/5 p-5 text-xl lg:w-2/3">
//                             Do you want a custom onboarding flow? Collect email addresses? Make users download a
//                             specific app or claim with a specific wallet? We've got your covered.
//                         </div>


//                         <a href="https://t.me/peanutprotocol" target="_blank" rel="noopener noreferrer">
//                             <button id="cta-btn" className="bg-white px-3 p-5 text-2xl font-black hover:underline cta">Talk to an expert →</button>
//                         </a>
//                     </div>
//                 </div>
//             </section>

//             {/* seperator */}
//             <global_components.MarqueeWrapper backgroundColor="bg-black">
//                 <>
//                     <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide md:py-4 md:text-4xl">
//                         FRENS
//                     </div>
//                     <img src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
//                     <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide md:py-4 md:text-4xl">
//                         FRENS
//                     </div>
//                     <img src={smiley.src} alt="logo" className="mr-1 h-5 md:h-8" />
//                 </>
//             </global_components.MarqueeWrapper>

//             {/* testimonials */}

//             <section id="testimonials" className="justify-center bg-white text-black sm:px-2 sm:py-2">
//                 <div role="list" className="grid grid-cols-2 gap-0 sm:gap-y-4 lg:grid-cols-4">
//                     {[
//                         {
//                             imageSrc: '/src/assets/people/orest.jpg',
//                             altText: 'picture of bearded man',
//                             comment: 'How did this not exist before?! Great UX!',
//                             name: 'Orest Tarasiuk',
//                             detail: 'Scroll.io',
//                             bgColorClass: 'bg-yellow',
//                         },
//                         {
//                             imageSrc: '/src/assets/people/mydas.jpg',
//                             altText: 'picture of rasta NFT',
//                             comment: 'Love this! Will help in mass crypto adoption.',
//                             name: 'Mydas.eth',
//                             detail: 'University of Nicosia',
//                             bgColorClass: 'bg-fuchsia',
//                         },
//                         {
//                             imageSrc: '/src/assets/people/Steven.jpg',
//                             altText: 'picture of smiling man',
//                             comment: 'Very buttery experience!',
//                             name: 'Steven Robinson',
//                             detail: 'Arkn Ventures',
//                             bgColorClass: 'bg-lightblue',
//                         },
//                         {
//                             imageSrc: '/src/assets/people/sbf.jpeg',
//                             altText: 'picture of pixel art SBF',
//                             comment: 'I have a peanut allergy. Help!',
//                             name: 'CEx CEO',
//                             detail: 'Probably FTX',
//                             bgColorClass: 'bg-red',
//                         },
//                     ].map((testimonial, index) => (
//                         <div
//                             key={index}
//                             className={`${testimonial.bgColorClass} brutalborder m-2 p-2 text-center`}
//                             id="frens"
//                         >
//                             <img
//                                 src={testimonial.imageSrc}
//                                 alt={testimonial.altText}
//                                 className="rainbow-border mx-auto w-1/2 rounded-full bg-white p-1"
//                             />
//                             <h1 className="mx-auto mt-2 py-2 text-base font-black italic lg:text-lg">
//                                 {testimonial.comment}
//                             </h1>
//                             <p className="mb-4 text-base font-black uppercase">
//                                 {testimonial.name}
//                                 <span className="text-xs">
//                                     {' '}
//                                     <br /> {testimonial.detail}{' '}
//                                 </span>
//                             </p>
//                         </div>
//                     ))}
//                 </div>
//             </section>

//             {/*  */}
//         </div>
//     )
// }
