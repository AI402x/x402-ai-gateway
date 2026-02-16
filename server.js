import express from "express";
import { paymentMiddleware } from "x402-express";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(express.json());

const WALLET_ADDRESS = "0x2C9297896F609718Fd2FeECFaCA019CFD8d2d1B7";
const PORT = process.env.PORT || 3000;
const facilitator = { url: process.env.FACILITATOR_URL || "https://x402.org/facilitator" };

// === GROQ AI (FREE, ULTRA-FAST) ===

const MODELS = {
  lite: "llama-3.1-8b-instant",
  standard: "llama-3.3-70b-versatile",
  pro: "qwen-qwq-32b",
  vision: "meta-llama/llama-4-scout-17b-16e-instruct",
};

async function callGroq(prompt, tier = "standard") {
  const model = MODELS[tier] || MODELS.standard;
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + process.env.GROQ_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    }),
  });
  if (!response.ok) throw new Error("Groq error: " + response.status);
  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) throw new Error("No Gemini key");
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!response.ok) throw new Error("Gemini error: " + response.status);
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

async function callOpenRouter(prompt) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("No OpenRouter key");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + process.env.OPENROUTER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openrouter/free",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    }),
  });
  if (!response.ok) throw new Error("OpenRouter error: " + response.status);
  const data = await response.json();
  return data.choices[0].message.content;
}

// === AUTO FAILOVER: Groq → Gemini → OpenRouter ===

async function callAI(prompt, tier = "standard") {
  const providers = [
    { name: "groq", fn: () => callGroq(prompt, tier) },
    { name: "gemini", fn: () => callGemini(prompt) },
    { name: "openrouter", fn: () => callOpenRouter(prompt) },
  ];
  for (const provider of providers) {
    try {
      const result = await provider.fn();
      if (result && result.trim().length > 0) return result;
    } catch (err) {
      console.log(provider.name + " failed: " + err.message + " - trying next...");
    }
  }
  throw new Error("All AI providers failed. Please try again later.");
}

// === x402 PAYMENT MIDDLEWARE ===

app.use(
  paymentMiddleware(
    WALLET_ADDRESS,
    {
      "/api/summarize": { price: "$0.003", network: "base", config: { description: "Summarize text (Llama 70B)" } },
      "/api/translate": { price: "$0.005", network: "base", config: { description: "Translate to any language (Llama 70B)" } },
      "/api/explain-code": { price: "$0.005", network: "base", config: { description: "Explain code in plain English (Llama 70B)" } },
      "/api/write": { price: "$0.01", network: "base", config: { description: "Generate written content (Llama 70B)" } },
      "/api/analyze-sentiment": { price: "$0.003", network: "base", config: { description: "Analyze sentiment of text (Llama 70B)" } },
      "/api/chat": { price: "$0.005", network: "base", config: { description: "General Q&A - ask anything (Llama 70B)" } },
      "/api/rewrite": { price: "$0.005", network: "base", config: { description: "Improve and rewrite text (Llama 70B)" } },
      "/api/proofread": { price: "$0.003", network: "base", config: { description: "Fix grammar and spelling (Llama 70B)" } },
      "/api/brainstorm": { price: "$0.01", network: "base", config: { description: "Generate creative ideas (Llama 70B)" } },
      "/api/eli5": { price: "$0.003", network: "base", config: { description: "Explain like I'm 5 (Llama 70B)" } },
      "/api/extract-keywords": { price: "$0.003", network: "base", config: { description: "Extract keywords from text (Llama 70B)" } },
      "/api/generate-title": { price: "$0.003", network: "base", config: { description: "Generate headlines (Llama 70B)" } },
      "/api/compare": { price: "$0.005", network: "base", config: { description: "Compare two things (Llama 70B)" } },
      "/api/code-review": { price: "$0.01", network: "base", config: { description: "Review code for bugs (Llama 70B)" } },
      "/api/sql-generate": { price: "$0.01", network: "base", config: { description: "Natural language to SQL (Llama 70B)" } },
      "/api/regex-generate": { price: "$0.005", network: "base", config: { description: "Natural language to regex (Llama 70B)" } },
      "/api/pro/chat": { price: "$0.02", network: "base", config: { description: "Pro Q&A - deep reasoning (Qwen QwQ 32B)" } },
      "/api/pro/write": { price: "$0.03", network: "base", config: { description: "Pro writing - best quality (Qwen QwQ 32B)" } },
      "/api/pro/code-review": { price: "$0.03", network: "base", config: { description: "Pro code review - deep analysis (Qwen QwQ 32B)" } },
      "/api/text-stats": { price: "$0.001", network: "base", config: { description: "Word count, reading time" } },
      "/api/json-format": { price: "$0.001", network: "base", config: { description: "Format and validate JSON" } },
      "/api/base64": { price: "$0.001", network: "base", config: { description: "Base64 encode or decode" } },
      "/api/password-strength": { price: "$0.001", network: "base", config: { description: "Analyze password strength" } },
      "/api/hash": { price: "$0.001", network: "base", config: { description: "Generate MD5, SHA256, SHA512 hash" } },
    },
    facilitator
  )
);

// === STANDARD AI ENDPOINTS (Llama 3.3 70B) ===

app.post("/api/summarize", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const result = await callAI("Summarize this concisely:\n\n" + text);
    res.json({ result, model: "llama-3.3-70b", endpoint: "summarize" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/translate", async (req, res) => {
  try {
    const { text, language } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const lang = language || "French";
    const result = await callAI("Translate to " + lang + ":\n\n" + text);
    res.json({ result, model: "llama-3.3-70b", endpoint: "translate", language: lang });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/explain-code", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Missing code" });
    const result = await callAI("Explain this code in plain English:\n\n" + code);
    res.json({ result, model: "llama-3.3-70b", endpoint: "explain-code" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/write", async (req, res) => {
  try {
    const { prompt, type } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });
    const result = await callAI("Write a " + (type || "general") + " based on:\n\n" + prompt);
    res.json({ result, model: "llama-3.3-70b", endpoint: "write" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/analyze-sentiment", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const result = await callAI("Analyze sentiment. Reply in JSON with sentiment, confidence, summary:\n\n" + text);
    res.json({ result, model: "llama-3.3-70b", endpoint: "analyze-sentiment" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "Missing question" });
    const result = await callAI(question);
    res.json({ result, model: "llama-3.3-70b", endpoint: "chat" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/rewrite", async (req, res) => {
  try {
    const { text, tone } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const t = tone || "professional";
    const result = await callAI("Rewrite this text in a " + t + " tone. Keep the meaning but improve clarity and style:\n\n" + text);
    res.json({ result, model: "llama-3.3-70b", endpoint: "rewrite", tone: t });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/proofread", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const result = await callAI("Proofread this text. Fix all grammar, spelling, and punctuation errors. Return the corrected version:\n\n" + text);
    res.json({ result, model: "llama-3.3-70b", endpoint: "proofread" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/brainstorm", async (req, res) => {
  try {
    const { topic, count } = req.body;
    if (!topic) return res.status(400).json({ error: "Missing topic" });
    const result = await callAI("Brainstorm " + (count || 10) + " creative and unique ideas about:\n\n" + topic);
    res.json({ result, model: "llama-3.3-70b", endpoint: "brainstorm" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/eli5", async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ error: "Missing topic" });
    const result = await callAI("Explain this like I'm 5 years old. Use simple words and fun examples:\n\n" + topic);
    res.json({ result, model: "llama-3.3-70b", endpoint: "eli5" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/extract-keywords", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const result = await callAI("Extract the most important keywords and key phrases from this text. Return them as a JSON array:\n\n" + text);
    res.json({ result, model: "llama-3.3-70b", endpoint: "extract-keywords" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/generate-title", async (req, res) => {
  try {
    const { text, count } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const result = await callAI("Generate " + (count || 5) + " catchy, engaging headlines/titles for this content:\n\n" + text);
    res.json({ result, model: "llama-3.3-70b", endpoint: "generate-title" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/compare", async (req, res) => {
  try {
    const { item1, item2 } = req.body;
    if (!item1 || !item2) return res.status(400).json({ error: "Missing item1 or item2" });
    const result = await callAI("Compare these two things in detail with pros, cons, and a recommendation:\n\n1: " + item1 + "\n2: " + item2);
    res.json({ result, model: "llama-3.3-70b", endpoint: "compare" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// === NEW DEVELOPER ENDPOINTS (Llama 3.3 70B) ===

app.post("/api/code-review", async (req, res) => {
  try {
    const { code, language } = req.body;
    if (!code) return res.status(400).json({ error: "Missing code" });
    const result = await callAI("Review this " + (language || "") + " code. Find bugs, security issues, and suggest improvements:\n\n" + code);
    res.json({ result, model: "llama-3.3-70b", endpoint: "code-review" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/sql-generate", async (req, res) => {
  try {
    const { description, dialect } = req.body;
    if (!description) return res.status(400).json({ error: "Missing description" });
    const result = await callAI("Generate a " + (dialect || "SQL") + " query for this request. Return only the query:\n\n" + description);
    res.json({ result, model: "llama-3.3-70b", endpoint: "sql-generate" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/regex-generate", async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) return res.status(400).json({ error: "Missing description" });
    const result = await callAI("Generate a regex pattern for this requirement. Return the regex and explain it:\n\n" + description);
    res.json({ result, model: "llama-3.3-70b", endpoint: "regex-generate" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// === PRO ENDPOINTS (Qwen QwQ 32B - Deep Reasoning) ===

app.post("/api/pro/chat", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "Missing question" });
    const result = await callAI(question, "pro");
    res.json({ result, model: "qwen-qwq-32b", tier: "pro", endpoint: "pro/chat" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/pro/write", async (req, res) => {
  try {
    const { prompt, type } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });
    const result = await callAI("Write a high-quality " + (type || "article") + " based on:\n\n" + prompt, "pro");
    res.json({ result, model: "qwen-qwq-32b", tier: "pro", endpoint: "pro/write" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/pro/code-review", async (req, res) => {
  try {
    const { code, language } = req.body;
    if (!code) return res.status(400).json({ error: "Missing code" });
    const result = await callAI("Do a deep, thorough code review of this " + (language || "") + " code. Analyze architecture, bugs, security, performance, and best practices:\n\n" + code, "pro");
    res.json({ result, model: "qwen-qwq-32b", tier: "pro", endpoint: "pro/code-review" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// === UTILITY ENDPOINTS (No AI) ===

app.post("/api/text-stats", (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const words = text.trim().split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim()).length;
    const characters = text.length;
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim()).length || 1;
    res.json({ words, sentences, characters, paragraphs, readingTimeMin: Math.ceil(words / 200), endpoint: "text-stats" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/json-format", (req, res) => {
  try {
    const { json, minify } = req.body;
    if (!json) return res.status(400).json({ error: "Missing json" });
    const parsed = typeof json === "string" ? JSON.parse(json) : json;
    res.json({ result: minify ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 2), valid: true, endpoint: "json-format" });
  } catch (err) { res.json({ result: null, valid: false, error: err.message, endpoint: "json-format" }); }
});

app.post("/api/base64", (req, res) => {
  try {
    const { text, action } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const result = (action || "encode") === "decode" ? Buffer.from(text, "base64").toString("utf-8") : Buffer.from(text).toString("base64");
    res.json({ result, action: action || "encode", endpoint: "base64" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/password-strength", (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "Missing password" });
    let score = 0;
    const checks = { length8: password.length >= 8, length12: password.length >= 12, length16: password.length >= 16, uppercase: /[A-Z]/.test(password), lowercase: /[a-z]/.test(password), numbers: /[0-9]/.test(password), symbols: /[^A-Za-z0-9]/.test(password), noCommon: !["password","123456","qwerty","admin","letmein","welcome"].includes(password.toLowerCase()) };
    Object.values(checks).forEach(v => { if (v) score += 12.5; });
    let strength = score >= 75 ? "strong" : score >= 50 ? "medium" : score >= 25 ? "weak" : "very weak";
    res.json({ score: Math.round(score), strength, checks, endpoint: "password-strength" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/hash", (req, res) => {
  try {
    const { text, algorithm } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const algo = algorithm || "sha256";
    if (!["md5","sha256","sha512"].includes(algo)) return res.status(400).json({ error: "Use: md5, sha256, sha512" });
    res.json({ hash: crypto.createHash(algo).update(text).digest("hex"), algorithm: algo, endpoint: "hash" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// === AGENT DISCOVERY ===

app.get("/.well-known/x402", (req, res) => {
  res.json({
    x402: true, version: 1, network: "base", facilitator: "https://x402.org/facilitator", payTo: WALLET_ADDRESS,
    endpoints: [
      { path: "/api/summarize", method: "POST", price: "$0.003", description: "Summarize text", model: "llama-3.3-70b" },
      { path: "/api/translate", method: "POST", price: "$0.005", description: "Translate to any language", model: "llama-3.3-70b" },
      { path: "/api/explain-code", method: "POST", price: "$0.005", description: "Explain code", model: "llama-3.3-70b" },
      { path: "/api/write", method: "POST", price: "$0.01", description: "Generate content", model: "llama-3.3-70b" },
      { path: "/api/analyze-sentiment", method: "POST", price: "$0.003", description: "Sentiment analysis", model: "llama-3.3-70b" },
      { path: "/api/chat", method: "POST", price: "$0.005", description: "General Q&A", model: "llama-3.3-70b" },
      { path: "/api/rewrite", method: "POST", price: "$0.005", description: "Improve/rewrite text", model: "llama-3.3-70b" },
      { path: "/api/proofread", method: "POST", price: "$0.003", description: "Fix grammar", model: "llama-3.3-70b" },
      { path: "/api/brainstorm", method: "POST", price: "$0.01", description: "Generate ideas", model: "llama-3.3-70b" },
      { path: "/api/eli5", method: "POST", price: "$0.003", description: "Explain like I'm 5", model: "llama-3.3-70b" },
      { path: "/api/extract-keywords", method: "POST", price: "$0.003", description: "Extract keywords", model: "llama-3.3-70b" },
      { path: "/api/generate-title", method: "POST", price: "$0.003", description: "Generate headlines", model: "llama-3.3-70b" },
      { path: "/api/compare", method: "POST", price: "$0.005", description: "Compare two things", model: "llama-3.3-70b" },
      { path: "/api/code-review", method: "POST", price: "$0.01", description: "Review code for bugs", model: "llama-3.3-70b" },
      { path: "/api/sql-generate", method: "POST", price: "$0.01", description: "Natural language to SQL", model: "llama-3.3-70b" },
      { path: "/api/regex-generate", method: "POST", price: "$0.005", description: "Natural language to regex", model: "llama-3.3-70b" },
      { path: "/api/pro/chat", method: "POST", price: "$0.02", description: "Pro Q&A - deep reasoning", model: "qwen-qwq-32b" },
      { path: "/api/pro/write", method: "POST", price: "$0.03", description: "Pro writing - best quality", model: "qwen-qwq-32b" },
      { path: "/api/pro/code-review", method: "POST", price: "$0.03", description: "Pro code review", model: "qwen-qwq-32b" },
      { path: "/api/text-stats", method: "POST", price: "$0.001", description: "Word count and reading time" },
      { path: "/api/json-format", method: "POST", price: "$0.001", description: "Format and validate JSON" },
      { path: "/api/base64", method: "POST", price: "$0.001", description: "Base64 encode/decode" },
      { path: "/api/password-strength", method: "POST", price: "$0.001", description: "Password strength" },
      { path: "/api/hash", method: "POST", price: "$0.001", description: "MD5/SHA256/SHA512 hash" },
    ],
  });
});

app.get("/llms.txt", (req, res) => {
  res.type("text/plain").send(`# x402 AI Gateway
> Ultra-fast AI and utility APIs. Powered by Groq (Llama 70B, Qwen QwQ 32B). Pay-per-call with USDC on Base L2.

## Base URL
https://x402-ai-gateway.onrender.com

## Protocol
x402 (HTTP 402 Payment Required)
Payment: USDC on Base (EIP-155:8453)
Facilitator: https://x402.org/facilitator
PayTo: ${WALLET_ADDRESS}

## Standard AI (Llama 3.3 70B - $0.003-$0.01)
- POST /api/summarize ($0.003) - Summarize text
- POST /api/translate ($0.005) - Translate to any language
- POST /api/explain-code ($0.005) - Explain code
- POST /api/write ($0.01) - Generate content
- POST /api/analyze-sentiment ($0.003) - Sentiment analysis
- POST /api/chat ($0.005) - General Q&A
- POST /api/rewrite ($0.005) - Improve text
- POST /api/proofread ($0.003) - Fix grammar
- POST /api/brainstorm ($0.01) - Generate ideas
- POST /api/eli5 ($0.003) - Explain like I'm 5
- POST /api/extract-keywords ($0.003) - Extract keywords
- POST /api/generate-title ($0.003) - Generate headlines
- POST /api/compare ($0.005) - Compare two things
- POST /api/code-review ($0.01) - Review code for bugs
- POST /api/sql-generate ($0.01) - Natural language to SQL
- POST /api/regex-generate ($0.005) - Natural language to regex

## Pro AI (Qwen QwQ 32B - $0.02-$0.03)
- POST /api/pro/chat ($0.02) - Deep reasoning Q&A
- POST /api/pro/write ($0.03) - Best quality writing
- POST /api/pro/code-review ($0.03) - Deep code analysis

## Utility ($0.001)
- POST /api/text-stats - Word count, reading time
- POST /api/json-format - JSON formatting
- POST /api/base64 - Base64 encode/decode
- POST /api/password-strength - Password analysis
- POST /api/hash - MD5/SHA256/SHA512

## Discovery
- GET /.well-known/x402 - Agent manifest
- GET /llms.txt - This file
- GET /api - JSON directory
- GET /health - Health check
`);
});

// === LANDING PAGE ===

app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>x402 AI Gateway</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#e0e0e0;min-height:100vh}
.hero{text-align:center;padding:60px 20px 40px}
.hero h1{font-size:2.5em;color:#fff;margin-bottom:10px}
.hero h1 span{color:#6366f1}
.hero p{font-size:1.2em;color:#888;margin-bottom:10px}
.sub{color:#16a34a;font-size:1em;margin-bottom:30px}
.badge{display:inline-block;background:#16a34a;color:#fff;padding:6px 16px;border-radius:20px;font-size:0.9em;margin-bottom:20px}
.stats{display:flex;justify-content:center;gap:40px;margin:30px 0;flex-wrap:wrap}
.stat{text-align:center}
.stat .num{font-size:2em;color:#6366f1;font-weight:bold}
.stat .label{color:#888;font-size:0.9em}
.endpoints{max-width:800px;margin:0 auto;padding:20px}
.endpoints h2{text-align:center;margin-bottom:20px;color:#fff}
.endpoint{background:#141414;border:1px solid #222;border-radius:10px;padding:16px 20px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}
.endpoint:hover{border-color:#6366f1}
.ep-left{display:flex;align-items:center;gap:12px}
.method{background:#6366f1;color:#fff;padding:3px 10px;border-radius:5px;font-size:0.8em;font-weight:bold}
.pro-method{background:#f59e0b}
.path{color:#fff;font-weight:500}
.desc{color:#888;font-size:0.85em}
.price{color:#16a34a;font-weight:bold;font-size:1.1em}
.section-label{text-align:center;color:#6366f1;font-size:0.85em;text-transform:uppercase;letter-spacing:2px;margin:30px 0 10px}
.pro-label{color:#f59e0b}
.how{max-width:800px;margin:40px auto;padding:20px}
.how h2{text-align:center;margin-bottom:20px;color:#fff}
.step{background:#141414;border:1px solid #222;border-radius:10px;padding:20px;margin-bottom:15px}
.step h3{color:#6366f1;margin-bottom:8px}
.step p{color:#888;line-height:1.6}
code{background:#1e1e1e;color:#6366f1;padding:2px 8px;border-radius:4px;font-size:0.9em}
.footer{text-align:center;padding:40px;color:#444;font-size:0.85em}
.cta{text-align:center;margin:30px 0}
.cta a{background:#6366f1;color:#fff;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:1.1em;margin:0 8px}
.cta a:hover{background:#4f46e5}
.cta a.secondary{background:transparent;border:1px solid #6366f1;color:#6366f1}
.cta a.secondary:hover{background:#6366f1;color:#fff}
</style>
</head>
<body>
<div class="hero">
<div class="badge">LIVE ON BASE MAINNET</div>
<h1><span>x402</span> AI Gateway</h1>
<p>Ultra-fast AI APIs powered by Groq + USDC micropayments</p>
<p class="sub">Llama 3.3 70B | Qwen QwQ 32B | Sub-second responses | 100% uptime failover</p>
<div class="stats">
<div class="stat"><div class="num">24</div><div class="label">Endpoints</div></div>
<div class="stat"><div class="num">$0.001</div><div class="label">Starting Price</div></div>
<div class="stat"><div class="num"><1s</div><div class="label">Response Time</div></div>
<div class="stat"><div class="num">USDC</div><div class="label">Base Network</div></div>
</div>
</div>
<div class="cta">
<a href="/api">API Directory</a>
<a href="/.well-known/x402" class="secondary">Agent Discovery</a>
<a href="/llms.txt" class="secondary">llms.txt</a>
</div>
<div class="endpoints">
<h2>Available Endpoints</h2>
<div class="section-label">Standard AI (Llama 3.3 70B)</div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/summarize</span><span class="desc">Summarize text</span></div><span class="price">$0.003</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/translate</span><span class="desc">Translate to any language</span></div><span class="price">$0.005</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/explain-code</span><span class="desc">Explain code</span></div><span class="price">$0.005</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/write</span><span class="desc">Generate content</span></div><span class="price">$0.01</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/analyze-sentiment</span><span class="desc">Sentiment analysis</span></div><span class="price">$0.003</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/chat</span><span class="desc">General Q&A</span></div><span class="price">$0.005</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/rewrite</span><span class="desc">Improve/rewrite text</span></div><span class="price">$0.005</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/proofread</span><span class="desc">Fix grammar & spelling</span></div><span class="price">$0.003</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/brainstorm</span><span class="desc">Generate ideas</span></div><span class="price">$0.01</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/eli5</span><span class="desc">Explain like I'm 5</span></div><span class="price">$0.003</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/extract-keywords</span><span class="desc">Extract keywords</span></div><span class="price">$0.003</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/generate-title</span><span class="desc">Generate headlines</span></div><span class="price">$0.003</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/compare</span><span class="desc">Compare two things</span></div><span class="price">$0.005</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/code-review</span><span class="desc">Review code for bugs</span></div><span class="price">$0.01</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/sql-generate</span><span class="desc">Natural language to SQL</span></div><span class="price">$0.01</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/regex-generate</span><span class="desc">Natural language to regex</span></div><span class="price">$0.005</span></div>
<div class="section-label pro-label">Pro AI (Qwen QwQ 32B - Deep Reasoning)</div>
<div class="endpoint"><div class="ep-left"><span class="method pro-method">POST</span><span class="path">/api/pro/chat</span><span class="desc">Deep reasoning Q&A</span></div><span class="price">$0.02</span></div>
<div class="endpoint"><div class="ep-left"><span class="method pro-method">POST</span><span class="path">/api/pro/write</span><span class="desc">Best quality writing</span></div><span class="price">$0.03</span></div>
<div class="endpoint"><div class="ep-left"><span class="method pro-method">POST</span><span class="path">/api/pro/code-review</span><span class="desc">Deep code analysis</span></div><span class="price">$0.03</span></div>
<div class="section-label">Utility Endpoints</div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/text-stats</span><span class="desc">Word count & reading time</span></div><span class="price">$0.001</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/json-format</span><span class="desc">Format & validate JSON</span></div><span class="price">$0.001</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/base64</span><span class="desc">Base64 encode/decode</span></div><span class="price">$0.001</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/password-strength</span><span class="desc">Password strength</span></div><span class="price">$0.001</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/hash</span><span class="desc">MD5/SHA256/SHA512</span></div><span class="price">$0.001</span></div>
</div>
<div class="how">
<h2>How It Works</h2>
<div class="step"><h3>1. Call any endpoint</h3><p>Send a POST request. Get a <code>402 Payment Required</code> response with payment details.</p></div>
<div class="step"><h3>2. Pay with USDC</h3><p>Sign a USDC payment on <code>Base</code> via x402. No gas fees - the facilitator covers them.</p></div>
<div class="step"><h3>3. Get your result</h3><p>Resend with payment proof in the <code>X-PAYMENT</code> header. Sub-second AI response.</p></div>
</div>
<div class="footer">
<p>Powered by Groq + x402 Protocol | Base Network | USDC</p>
<p style="margin-top:8px">PayTo: <code>${WALLET_ADDRESS}</code></p>
</div>
</body>
</html>`);
});

// === DISCOVERY ENDPOINTS ===

app.get("/health", (req, res) => {
  res.json({ status: "online", network: "base", ai: "groq", models: ["llama-3.3-70b", "qwen-qwq-32b"], failover: ["gemini", "openrouter"], endpoints: 24 });
});

app.get("/api", (req, res) => {
  res.json({
    name: "x402 AI Gateway",
    description: "Ultra-fast AI APIs powered by Groq. Pay-per-call with USDC via x402.",
    network: "base", payTo: WALLET_ADDRESS,
    standardEndpoints: [
      { method: "POST", path: "/api/summarize", price: "$0.003", model: "llama-3.3-70b", description: "Summarize text" },
      { method: "POST", path: "/api/translate", price: "$0.005", model: "llama-3.3-70b", description: "Translate to any language" },
      { method: "POST", path: "/api/explain-code", price: "$0.005", model: "llama-3.3-70b", description: "Explain code" },
      { method: "POST", path: "/api/write", price: "$0.01", model: "llama-3.3-70b", description: "Generate content" },
      { method: "POST", path: "/api/analyze-sentiment", price: "$0.003", model: "llama-3.3-70b", description: "Sentiment analysis" },
      { method: "POST", path: "/api/chat", price: "$0.005", model: "llama-3.3-70b", description: "General Q&A" },
      { method: "POST", path: "/api/rewrite", price: "$0.005", model: "llama-3.3-70b", description: "Improve text" },
      { method: "POST", path: "/api/proofread", price: "$0.003", model: "llama-3.3-70b", description: "Fix grammar" },
      { method: "POST", path: "/api/brainstorm", price: "$0.01", model: "llama-3.3-70b", description: "Generate ideas" },
      { method: "POST", path: "/api/eli5", price: "$0.003", model: "llama-3.3-70b", description: "Explain like I'm 5" },
      { method: "POST", path: "/api/extract-keywords", price: "$0.003", model: "llama-3.3-70b", description: "Extract keywords" },
      { method: "POST", path: "/api/generate-title", price: "$0.003", model: "llama-3.3-70b", description: "Generate headlines" },
      { method: "POST", path: "/api/compare", price: "$0.005", model: "llama-3.3-70b", description: "Compare two things" },
      { method: "POST", path: "/api/code-review", price: "$0.01", model: "llama-3.3-70b", description: "Review code" },
      { method: "POST", path: "/api/sql-generate", price: "$0.01", model: "llama-3.3-70b", description: "Natural language to SQL" },
      { method: "POST", path: "/api/regex-generate", price: "$0.005", model: "llama-3.3-70b", description: "Natural language to regex" },
    ],
    proEndpoints: [
      { method: "POST", path: "/api/pro/chat", price: "$0.02", model: "qwen-qwq-32b", description: "Deep reasoning Q&A" },
      { method: "POST", path: "/api/pro/write", price: "$0.03", model: "qwen-qwq-32b", description: "Best quality writing" },
      { method: "POST", path: "/api/pro/code-review", price: "$0.03", model: "qwen-qwq-32b", description: "Deep code analysis" },
    ],
    utilityEndpoints: [
      { method: "POST", path: "/api/text-stats", price: "$0.001", description: "Word count and reading time" },
      { method: "POST", path: "/api/json-format", price: "$0.001", description: "Format and validate JSON" },
      { method: "POST", path: "/api/base64", price: "$0.001", description: "Base64 encode/decode" },
      { method: "POST", path: "/api/password-strength", price: "$0.001", description: "Password strength" },
      { method: "POST", path: "/api/hash", price: "$0.001", description: "MD5/SHA256/SHA512 hash" },
    ],
    discovery: [
      { method: "GET", path: "/health" },
      { method: "GET", path: "/api" },
      { method: "GET", path: "/.well-known/x402" },
      { method: "GET", path: "/llms.txt" },
    ],
  });
});

// === START ===

app.listen(PORT, () => {
  console.log("==========================================");
  console.log("  x402 AI GATEWAY - GROQ POWERED");
  console.log("  http://localhost:" + PORT);
  console.log("  Network: Base Mainnet");
  console.log("  AI: Groq (Llama 70B + Qwen QwQ 32B)");
  console.log("  Failover: Gemini → OpenRouter");
  console.log("  Endpoints: 24 (16 standard + 3 pro + 5 utility)");
  console.log("  Wallet: " + WALLET_ADDRESS);
  console.log("==========================================");
});