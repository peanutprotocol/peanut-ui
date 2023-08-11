import * as global_components from "@/components/global";
import smiley from "@/assets/smiley.svg";
import hugo_png from "@/assets/people/hugo0-no-bg.png";
import konrad_png from "@/assets/people/kkonrad-no-bg.png";
import peanutman_cheering from "@/assets/peanutman-cheering.svg";

export function About() {
  return (
    <div>
      <div className="bg-lightblue flex-grow">
        <div className="brutalborder brutalshadow bg-white w-5/6 mx-auto mb-32 ">
          <h2 className="text-black font-black text-xl lg:text-4xl px-4 mx-auto text-center">
            <p>WE MAKE TRANSFERS MAGIC </p>
          </h2>
        </div>
      </div>
      <global_components.MarqueeWrapper backgroundColor="bg-black">
        <>
          <div className="italic text-center uppercase mr-2 font-black tracking-wide md:text-4xl md:py-4 py-2">
            Hugo
          </div>
          <img src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
          <div className="italic text-center uppercase mr-2 font-black tracking-wide md:text-4xl md:py-4 py-2">
            Konrad
          </div>
          <img src={smiley.src} alt="logo" className="h-5 mr-1 md:h-8" />
        </>
      </global_components.MarqueeWrapper>

      <div>
        <div
          role="list"
          className="grid grid-cols-1 gap-0 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 bg-white"
        >
          <div className="bg-yellow brutalborder p-8 m-4 text-center flex flex-col text-black">
            <div className="flex-grow">
              <img
                src={hugo_png.src}
                alt="picture of bearded man"
                className="w-1/2 m-2 mx-auto bg-white rounded-full rainbow-border p-4"
              />

              <h1 className="mt-8 text-2xl font-black w-3/4 uppercase mx-auto">
                Hugo Montenegro
              </h1>
              <p className="uppercase mb-4 font-black text-sm">Tech Nut</p>
              <p>
                Did ML and worked with NLP. Studied CS at Harvard. Main
                interests lie in decentralized systems and how incentives affect
                them. Also in AI and allied with our AI overlords, and
                increasing healthspan.
              </p>
              <p>
                He's also very tall and, yes, he likes to play basketball. He's
                currently doing a keto diet. [Edit: Not anymore.]
              </p>
            </div>

            <div className="center-xy flex justify-around flex-end gap-12 my-6">
              <p className="mt-4 uppercase font-black text-sm text-black">
                <a
                  className="underline text-black"
                  href="https://www.twitter.com/uwwgo"
                >
                  Twitter
                </a>{" "}
                |{" "}
                <a
                  className="underline text-black"
                  href="https://lenster.xyz/u/hugo0.lens"
                >
                  Lens
                </a>{" "}
                |{" "}
                <a
                  className="underline text-black"
                  href="https://hugomontenegro.com/"
                >
                  www
                </a>
              </p>
            </div>
          </div>

          <div className="bg-red brutalborder p-8 m-4 text-center flex flex-col text-black">
            <div className="flex-grow">
              <img
                src={konrad_png.src}
                alt="handsome polish man"
                className="w-1/2 m-2 mx-auto bg-white rounded-full rainbow-border p-4"
              />

              <h1 className="mt-8 text-2xl font-black w-3/4  uppercase mx-auto ">
                Konrad Urban
              </h1>
              <p className="uppercase mb-4 font-black text-sm ">Biz Nut</p>
              <p>
                Does biz and design. Did academic philosophy at St Andrews but
                escaped to build stuff.{" "}
              </p>

              <p>
                {" "}
                Likes to climb and then ski untouched mountains. At night you
                can find him your local juke joints swing & blues dancing.
              </p>
            </div>
            <div className="center-xy flex justify-around flex-end gap-12 my-6">
              <p className="mt-4 uppercase font-black text-sm">
                <a
                  className="underline text-black"
                  href="https://www.twitter.com/0xkkonrad"
                >
                  Twitter
                </a>{" "}
                |{" "}
                <a
                  className="underline text-black"
                  href="https://lenster.xyz/u/kkonrad.lens"
                >
                  Lens
                </a>{" "}
                |{" "}
                <a
                  className="underline text-black"
                  href="https://konradurban.com/"
                >
                  www
                </a>
              </p>
            </div>
          </div>

          <div className="bg-lightblue brutalborder p-8 m-4 text-center text-black flex flex-col">
            <div className="flex-grow">
              <img
                src={peanutman_cheering.src}
                alt="Very handsome and happy peanut man"
                className="w-1/2 m-2 mx-auto bg-white rounded-full rainbow-border p-4"
              />

              <h1 className="mt-8 text-2xl font-black w-3/4  uppercase mx-auto">
                ______ ______
              </h1>
              <p className="uppercase mb-4 font-black text-sm ">____ Nut</p>
              <p>Does ____ and ____. Did ____ but _______. </p>

              <p> Likes to ______. Sometimes also __________.</p>
              <p>
                {" "}
                Got this job after seeing the /about page and then DMing Konrad
                and Hugo.
              </p>
            </div>

            <div className="center-xy flex justify-around flex-end gap-12 my-6 font-black">
              <p className="mt-4 uppercase font-black text-sm">
                <a
                  className="underline text-black"
                  href="https://www.twitter.com/PeanutProtocol"
                >
                  dm us
                </a>{" "}
                |{" "}
                <a
                  className="underline text-black"
                  href="https://peanut.to/jobs"
                >
                  jobs
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
