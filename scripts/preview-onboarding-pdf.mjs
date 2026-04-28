// Renderuje obě onboarding PDF (Standard + Brief) pro vizuální preview.
// Použití: npx tsx scripts/preview-onboarding-pdf.mjs
import { writeFileSync } from "node:fs";
import { renderOnboardingPdf } from "../src/lib/onboarding-pdf.ts";

const data = {
  guestName: "Karel",
  projectName: "ART76 brainstorm",
  projectDescription:
    "Rebranding značky ART76 pro novou sezónu 2026. Vyvíjíme novou brand identitu, web a komunikační strategii.",
  inviteLink: "https://www.raseliniste.cz/me/abc123def456ghi789jkl012mno345pq",
};

const standard = await renderOnboardingPdf("standard", data);
writeFileSync("/tmp/onboarding-standard.pdf", standard);
console.log(`✓ /tmp/onboarding-standard.pdf (${standard.length} bytes)`);

const brief = await renderOnboardingPdf("brief", data);
writeFileSync("/tmp/onboarding-brief.pdf", brief);
console.log(`✓ /tmp/onboarding-brief.pdf (${brief.length} bytes)`);
