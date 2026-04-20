import { GoogleGenAI } from "@google/genai";
import { env } from "./env";

let client: GoogleGenAI | null = null;

export function getGemini() {
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
  if (!client) client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return client;
}

// Default — rychlý, levný, kvalita pro klasifikaci / chat je dostatečná.
// Tohle volá: capture classifier, AI chat (když není fast=false), jakákoli běžná operace.
export const DEFAULT_MODEL = "gemini-2.5-flash";

// Alias zachovaný pro zpětnou kompatibilitu s existujícím kódem.
export const FAST_MODEL = "gemini-2.5-flash";

// Pro hlubší úvahu — zdravotní analýzy, budoucí komplexní agenty.
export const ANALYSIS_MODEL = "gemini-2.5-pro";
