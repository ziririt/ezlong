#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "time", "data", "quote-archive-manifest.json");
const inputPath = process.argv[2];

function kstNow() {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).replace(" ", "T") + "+09:00";
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizeQuote(quote) {
  if (!quote || !quote.text || !quote.title || !quote.author) return null;
  return {
    id: quote.id || `quote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    english: quote.english || "",
    text: String(quote.text).trim(),
    title: String(quote.title).trim(),
    author: String(quote.author).trim(),
    category: quote.category || "mindset",
    rights: quote.rights || "short-quote",
    sourceType: quote.sourceType || "curated",
    sourceUrl: quote.sourceUrl || "",
    addedAtKST: quote.addedAtKST || kstNow()
  };
}

function readCandidates(filePath) {
  if (!filePath) return [];
  const raw = fs.readFileSync(filePath, "utf8");
  if (filePath.endsWith(".json")) {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed.quotes || [];
  }
  return raw
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((text) => ({ text, title: "검수 필요", author: "검수 필요", category: "mindset", rights: "review-needed" }));
}

if (!inputPath) {
  console.error("Usage: node scripts/merge-time-quotes.js <quotes.json|quotes.txt>");
  process.exit(1);
}

const manifest = readJson(manifestPath, {
  updatedAtKST: "",
  schemaVersion: 1,
  policy: "Short attributed investment quotes for mental-weather clock rotation.",
  quotes: []
});

const seen = new Set((manifest.quotes || []).map((quote) => `${quote.title}|${quote.author}|${quote.text}`));
const candidates = readCandidates(path.resolve(inputPath)).map(normalizeQuote).filter(Boolean);
const added = [];

for (const quote of candidates) {
  const key = `${quote.title}|${quote.author}|${quote.text}`;
  if (seen.has(key)) continue;
  seen.add(key);
  added.push(quote);
}

manifest.updatedAtKST = kstNow();
manifest.quotes = [...(manifest.quotes || []), ...added];
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`candidates=${candidates.length} added=${added.length} total=${manifest.quotes.length}`);
