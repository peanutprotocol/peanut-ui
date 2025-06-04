import { PaymentLink } from "@/interfaces";

function usernamePxWidth(name: string) {
  const charPx = 0.6 * 80; // ≈48 px per glyph
  return Math.round(name.length * charPx) + 40; // +40 padding
}

export function PaymentCardOG({
  link,
  iconSrc,
  logoSrc,
}: {
  link: PaymentLink;
  iconSrc: string;
  logoSrc: string;
}) {
  /* ----- palette ----- */
  const pink = "#fe91e6";
  const scribbleSrc =
    "https://img.notionusercontent.com/s3/prod-files-secure%2Fb08e0384-3fae-465c-8ce5-c02ee949214b%2Fa31955a0-ca83-45e5-a7dc-c97538770602%2FVector_(1).svg/size/?exp=1747525540&sig=SIwQkLtIyYVghKSBBpc7XQSga_fKqRoAuVTOH1TZxag&id=1f383811-7579-80cb-b98d-e4ac52963610&table=block";
  const scribbleWidth = usernamePxWidth(link.username);

  /* ----- outer white frame ----- */
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        backgroundColor: "#ffffff",
        borderRadius: 24, // Tailwind rounded-2xl
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
          width: 1000,
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
            left: 24,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <img src={iconSrc} width={36} height={36} alt="Peanut icon" />
          <img src={logoSrc} width={100} height={24} alt="Peanut" />
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
            fontSize: 36,
            margin: 0,
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
            fontSize: 200, // px
            lineHeight: 1,
            margin: 0,
            marginTop: 30,
          }}
        >
          {/* 1) white fill — stays in normal flow */}
          <span
            style={{
              fontFamily: "Knerd Filled",
              color: "#fff",
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
            }}
          >
            ${link.amount}
          </span>
        </p>
      </div>
    </div>
  );
}
