#!/usr/bin/env node
/**
 * Merge curated investment quotes into the ezlong time quote archive.
 *
 * Usage:
 *   npm run archive:time-quotes -- /path/to/new-quotes.json
 *
 * Input JSON may be an array or { "quotes": [...] }.
 * Required fields: text, title, author.
 * Duplicate key: normalized title + author + text.
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "time", "data", "quote-archive-manifest.json");
const runtimeTargets = [
  path.join(root, "time", "investment-quotes.js"),
  path.join(root, "mobile", "time-app", "www", "investment-quotes.js")
];
const knownCategories = new Set(["mindset", "compound", "volatility", "patience", "behavior", "retirement"]);
const defaultCategory = "mindset";

function nowKST() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().replace("Z", "+09:00");
}

function normalizeKey(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function dedupKey(quote) {
  return [quote.title, quote.author, quote.text].map(normalizeKey).join("|");
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function readExistingRuntimeQuotes() {
  const runtimePath = path.join(root, "time", "investment-quotes.js");
  if (!fs.existsSync(runtimePath)) return [];

  const source = fs.readFileSync(runtimePath, "utf8");
  const match = source.match(/window\.investmentQuotes\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
  if (!match) return [];

  try {
    return Function(`"use strict"; return (${match[1]});`)();
  } catch (error) {
    console.warn(`Could not parse existing investment-quotes.js: ${error.message}`);
    return [];
  }
}

function loadManifest() {
  const existing = readJson(manifestPath, null);
  if (existing && Array.isArray(existing.quotes)) return existing;

  const seedQuotes = readExistingRuntimeQuotes().map((quote) => ({
    id: "",
    english: quote.english || "",
    text: String(quote.text || "").trim(),
    title: String(quote.title || "").trim(),
    author: String(quote.author || "").trim(),
    category: knownCategories.has(quote.category) ? quote.category : defaultCategory,
    rights: "short-quote",
    sourceType: "curated",
    sourceUrl: "",
    addedAtKST: nowKST()
  })).filter((quote) => quote.text && quote.title && quote.author);

  return {
    updatedAtKST: nowKST(),
    schemaVersion: 1,
    policy: "Short attributed investment quotes for mental-weather clock rotation.",
    quotes: seedQuotes
  };
}

function loadIncomingQuotes(inputPath) {
  const parsed = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const list = Array.isArray(parsed) ? parsed : parsed.quotes;
  if (!Array.isArray(list)) {
    throw new Error("Input must be an array or { quotes: [...] }.");
  }
  return list;
}

function normalizeQuote(quote, index) {
  const text = String(quote.text || "").trim();
  const title = String(quote.title || "").trim();
  const author = String(quote.author || "").trim();
  if (!text || !title || !author) {
    throw new Error(`Quote at index ${index} is missing text/title/author.`);
  }

  return {
    id: quote.id || "",
    english: String(quote.english || "").trim(),
    text,
    title,
    author,
    category: knownCategories.has(quote.category) ? quote.category : defaultCategory,
    rights: quote.rights || "short-quote",
    sourceType: quote.sourceType || "curated",
    sourceUrl: quote.sourceUrl || "",
    addedAtKST: quote.addedAtKST || nowKST()
  };
}

function writeRuntimeFile(targetPath, quotes) {
  const runtimeQuotes = quotes.map((quote) => {
    const category = knownCategories.has(quote.category) ? quote.category : defaultCategory;
    return quote.english
      ? { english: quote.english, text: quote.text, title: quote.title, author: quote.author, category }
      : { text: quote.text, title: quote.title, author: quote.author, category };
  });

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `window.investmentQuotes = ${JSON.stringify(runtimeQuotes, null, 2)};\n`);
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: npm run archive:time-quotes -- /path/to/new-quotes.json");
    process.exit(1);
  }
  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const manifest = loadManifest();
  const seen = new Set((manifest.quotes || []).map(dedupKey));
  const incoming = loadIncomingQuotes(path.resolve(inputPath)).map(normalizeQuote);
  let added = 0;
  let skipped = 0;

  for (const quote of incoming) {
    const key = dedupKey(quote);
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    manifest.quotes.push(quote);
    added += 1;
  }

  manifest.updatedAtKST = nowKST();
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  for (const target of runtimeTargets) {
    writeRuntimeFile(target, manifest.quotes);
  }

  console.log(`merged: added=${added} skipped=${skipped} total=${manifest.quotes.length}`);
  console.log(`updated: ${manifestPath}`);
}

main();
