/* eslint-disable @typescript-eslint/no-explicit-any */
import { Document, Page, Text, View, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import { resolveUpload, uploadExists } from "./uploads";

/**
 * PDF generátor dopisů (server-side přes @react-pdf/renderer).
 * Layout A4 portrét, klasický business style.
 *
 * Šablony:
 *   - "classic" (jediná zatím) — logo top-left, text odesílatele pod ním,
 *     adresát top-right, datum + místo, tělo dopisu, sken podpisu, patička.
 */

export interface LetterPdfData {
  sender: {
    name: string;
    legalName: string | null;
    ico: string | null;
    dic: string | null;
    addressLines: string[];
    email: string | null;
    phone: string | null;
    web: string | null;
    bankAccount: string | null;
    logoPath: string | null;
    signaturePath: string | null;
    pdfTheme: string;
  };
  recipient: {
    name: string;
    addressLines: string[];
    showAddress: boolean;
  } | null;
  letterDate: Date;
  place: string | null;
  body: string;
}

function fmtCzechDate(d: Date): string {
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 60,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
    lineHeight: 1.45,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 36,
  },
  senderBlock: {
    flexDirection: "column",
    maxWidth: 260,
  },
  senderLogo: {
    maxWidth: 130,
    maxHeight: 60,
    marginBottom: 10,
    objectFit: "contain",
  },
  senderName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  senderLine: {
    fontSize: 9,
    color: "#444",
  },
  recipientBlock: {
    flexDirection: "column",
    minWidth: 200,
    maxWidth: 240,
    paddingTop: 50,
  },
  recipientName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    marginBottom: 2,
  },
  recipientLine: {
    fontSize: 11,
  },
  dateLine: {
    fontSize: 10,
    color: "#444",
    marginBottom: 24,
    textAlign: "right",
  },
  body: {
    marginTop: 8,
    fontSize: 11,
  },
  paragraph: {
    marginBottom: 10,
  },
  signatureBlock: {
    marginTop: 32,
  },
  signatureImage: {
    width: 120,
    height: 50,
    objectFit: "contain",
    marginBottom: 4,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 60,
    right: 60,
    borderTop: "1pt solid #cccccc",
    paddingTop: 8,
    fontSize: 8,
    color: "#666",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
});

function paragraphs(text: string): string[] {
  // Rozdělíme podle prázdných řádků (klasický odstavec).
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

async function loadImageIfExists(relativePath: string | null): Promise<string | null> {
  if (!relativePath) return null;
  const exists = await uploadExists(relativePath);
  if (!exists) return null;
  return resolveUpload(relativePath);
}

function footerItems(s: LetterPdfData["sender"]): string[] {
  const items: string[] = [];
  if (s.legalName) items.push(s.legalName);
  if (s.ico) items.push(`IČ ${s.ico}`);
  if (s.dic) items.push(`DIČ ${s.dic}`);
  if (s.email) items.push(s.email);
  if (s.phone) items.push(s.phone);
  if (s.web) items.push(s.web);
  if (s.bankAccount) items.push(`č.ú. ${s.bankAccount}`);
  return items;
}

function ClassicLetter({ data, logoSrc, signatureSrc }: {
  data: LetterPdfData;
  logoSrc: string | null;
  signatureSrc: string | null;
}): ReactElement {
  const dateStr = fmtCzechDate(data.letterDate);
  const dateHeader = data.place ? `${data.place} dne ${dateStr}` : dateStr;
  const paras = paragraphs(data.body);
  const footerLines = footerItems(data.sender);

  return h(Document, null,
    h(Page as any, { size: "A4", style: styles.page },
      // Top row: sender (left) + recipient (right)
      h(View, { style: styles.topRow },
        h(View, { style: styles.senderBlock },
          logoSrc && h(Image as any, { src: logoSrc, style: styles.senderLogo }),
          h(Text, { style: styles.senderName }, data.sender.name),
          ...data.sender.addressLines.map((line, i) =>
            h(Text, { key: `s-${i}`, style: styles.senderLine }, line)
          ),
        ),
        data.recipient && h(View, { style: styles.recipientBlock },
          h(Text, { style: styles.recipientName }, data.recipient.name),
          data.recipient.showAddress && data.recipient.addressLines.map((line, i) =>
            h(Text, { key: `r-${i}`, style: styles.recipientLine }, line)
          ),
        ),
      ),

      // Date line (right-aligned)
      h(Text, { style: styles.dateLine }, dateHeader),

      // Body
      h(View, { style: styles.body },
        ...paras.map((para, i) =>
          h(Text, { key: `p-${i}`, style: styles.paragraph }, para)
        ),
      ),

      // Signature block
      signatureSrc && h(View, { style: styles.signatureBlock },
        h(Image as any, { src: signatureSrc, style: styles.signatureImage }),
      ),

      // Footer (sender contact info)
      footerLines.length > 0 && h(View, { style: styles.footer },
        ...footerLines.map((item, i) =>
          h(Text, { key: `f-${i}` }, item)
        ),
      ),
    ),
  );
}

export async function renderLetterPdf(data: LetterPdfData): Promise<Buffer> {
  const logoSrc = await loadImageIfExists(data.sender.logoPath);
  const signatureSrc = await loadImageIfExists(data.sender.signaturePath);

  // Pro budoucí přepínání témat podle data.sender.pdfTheme
  // přepneme tady — zatím "classic" = default.
  const doc = ClassicLetter({ data, logoSrc, signatureSrc });

  const stream = await pdf(doc as any).toBuffer();
  // toBuffer vrací NodeJS.ReadableStream; sesbíráme do Bufferu
  return await streamToBuffer(stream);
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}
