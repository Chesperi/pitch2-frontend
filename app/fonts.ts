import localFont from "next/font/local";

export const oscine = localFont({
  src: [
    { path: "../public/fonts/DAZN_Oscine_Rg.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/DAZN_Oscine_Bd.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-oscine",
  display: "swap",
});
