import { PaymentLink } from "@/interfaces";

function usernamePxWidth(name: string) {
  const charPx = 0.6 * 80; // ≈48 px per glyph
  return Math.round(name.length * charPx) + 40; // +40 padding
}

export function PaymentCardOG({
  link,
  iconSrc,
  logoSrc,
  scribbleSrc,
  arrowSrcs
}: {
  link: PaymentLink;
  iconSrc: string;
  logoSrc: string;
  scribbleSrc: string;
  arrowSrcs: {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
  };
}) {
  /* ----- palette ----- */
  const pink = "#fe91e6";
  const scribbleWidth = usernamePxWidth(link.username);

  /* ----- outer white frame ----- */
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        backgroundColor: "#ffffff",
        padding: 16,
        width: 1200,
        height: 630,
      }}
    >
      {/* inner coloured card ---------------------------------------- */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          width: '100%',
          border: "3px solid #000",
          backgroundColor: pink,
          padding: 48,
          color: "#000",
        }}
      >
        {/*  logo top-left  */}
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 34,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <img src={iconSrc} width={36} height={46} alt="Peanut icon" />
          <img src={logoSrc} width={132} height={26} alt="Peanut" />
        </div>

        {/*  username  */}
        <div
          style={{
            position: "relative",
            display: "flex", // ← now it’s explicit flex
            flexDirection: "column", // stack H2 then IMG
            alignItems: "center", // center them horizontally
            marginBottom: 8,
            width: "100%",
          }}
        >
          {/* 1) the username in flow */}
          <h2
            style={{
              fontFamily: "Montserrat SemiBold",
              fontWeight: 700,
              fontSize: 80,
              margin: 0,
              letterSpacing: "-0.05em",
            }}
          >
            {link.username}
          </h2>

          {/* 2) the scribble on top, absolutely positioned */}
          <img
            src={scribbleSrc}
            width={scribbleWidth}
            height={130}
            alt=""
            style={{
              position: "absolute",
              top: -20,
              left: "50%",
              transform: "translateX(-50%)",
              pointerEvents: "none",
            }}
          />
        </div>
        {/*  action text  */}
        <p
          style={{
            fontFamily: "Montserrat Medium",
            fontWeight: 500,
            fontSize: 46,
            margin: 0,
            marginTop: -12,
            letterSpacing: "-0.03em",
          }}
        >
          {link.type === "send" ? "is sending you" : "is requesting"}
        </p>

        {/*  big outlined amount  */}
        {/* $ amount — white fill first, outline absolute & on top */}
        <p
          style={{
            position: "relative",
            display: "block", // only flex | block | none | -webkit-box are allowed
            fontSize: 250, // px
            lineHeight: 1,
            margin: 0,
            marginTop: 30,
          }}
        >
          {/* Top-left arrow */}
          <img 
            src={arrowSrcs.topLeft}
            width={100}
            height={100}
            alt=""
            style={{
              position: "absolute",
              top: -110,
              left: -60,
              pointerEvents: "none",
            }}
          />
          
          {/* Top-right arrow */}
          <img 
            src={arrowSrcs.topRight}
            width={130}
            height={80}
            alt=""
            style={{
              position: "absolute",
              top: -90,
              right: -100,
              pointerEvents: "none",
              transform: "rotate(5deg)"
            }}
          />
          
          {/* 1) white fill — stays in normal flow */}
          <span
            style={{
              fontFamily: "Knerd Filled",
              color: "#fff",
              letterSpacing: "-0.08em",
            }}
          >
            ${link.amount}
          </span>

          {/* 2) black outline — absolutely positioned, painted *after* → on top */}
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 3, // positive offset → outline shows down-right
              left: 3,
              fontFamily: "Knerd Outline",
              color: "#000",
              pointerEvents: "none", // just in case
              transformOrigin: "top left",
              transform: "scaleX(1.01) scaleY(1.01)",
              letterSpacing: "-0.08em",
            }}
          >
            ${link.amount}
          </span>
          
          {/* Bottom-left arrow */}
          <img 
            src={arrowSrcs.bottomLeft}
            width={64}
            height={96}
            alt=""
            style={{
              position: "absolute",
              bottom: 10,
              left: -20,
              pointerEvents: "none",
            }}
          />
          
          {/* Bottom-right arrow */}
          <img 
            src={arrowSrcs.bottomRight}
            width={40}
            height={60}
            alt=""
            style={{
              position: "absolute",
              bottom: 10,
              right: -20,
              pointerEvents: "none",
              transform: "rotate(-15deg)"
            }}
          />
        </p>
      </div>
    </div>
  );
}
