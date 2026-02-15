import express from "express";
import { paymentMiddleware } from "x402-express";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(express.json());

const WALLET_ADDRESS = "0x2C9297896F609718Fd2FeECFaCA019CFD8d2d1B7";
const PORT = process.env.PORT || 3000;
const AI_PROVIDER = process.env.AI_PROVIDER || "openrouter";
const facilitator = { url: process.env.FACILITATOR_URL || "https://x402.org/facilitator" };

// === AI PROVIDERS ===

async function callAI(prompt) {
  if (AI_PROVIDER === "gemini") return await callGemini(prompt);
  if (AI_PROVIDER === "huggingface") return await callHuggingFace(prompt);
  return await callOpenRouter(prompt);
}

async function callOpenRouter(prompt) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + process.env.OPENROUTER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openrouter/free",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
    }),
  });
  if (!response.ok) throw new Error("OpenRouter error: " + await response.text());
  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGemini(prompt) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!response.ok) throw new Error("Gemini error: " + await response.text());
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

async function callHuggingFace(prompt) {
  const response = await fetch(
    "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3",
    {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.HF_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 500 } }),
    }
  );
  if (!response.ok) throw new Error("HuggingFace error: " + await response.text());
  const data = await response.json();
  return Array.isArray(data) ? data[0].generated_text : data.generated_text;
}

// === x402 PAYMENT MIDDLEWARE ===

app.use(
  paymentMiddleware(
    WALLET_ADDRESS,
    {
      "/api/summarize": { price: "$0.005", network: "base", config: { description: "Summarize any text into key points" } },
      "/api/translate": { price: "$0.01", network: "base", config: { description: "Translate text to any language" } },
      "/api/explain-code": { price: "$0.01", network: "base", config: { description: "Explain what code does in plain English" } },
      "/api/write": { price: "$0.02", network: "base", config: { description: "Generate written content" } },
      "/api/analyze-sentiment": { price: "$0.005", network: "base", config: { description: "Analyze the sentiment of text" } },
      "/api/chat": { price: "$0.01", network: "base", config: { description: "General Q&A - ask anything" } },
      "/api/rewrite": { price: "$0.01", network: "base", config: { description: "Improve and rewrite text professionally" } },
      "/api/proofread": { price: "$0.005", network: "base", config: { description: "Fix grammar, spelling, and punctuation" } },
      "/api/brainstorm": { price: "$0.02", network: "base", config: { description: "Generate creative ideas on any topic" } },
      "/api/eli5": { price: "$0.005", network: "base", config: { description: "Explain anything like I'm 5 years old" } },
      "/api/extract-keywords": { price: "$0.005", network: "base", config: { description: "Extract keywords and key phrases from text" } },
      "/api/generate-title": { price: "$0.005", network: "base", config: { description: "Generate catchy headlines and titles" } },
      "/api/compare": { price: "$0.01", network: "base", config: { description: "Compare two things with pros and cons" } },
      "/api/text-stats": { price: "$0.001", network: "base", config: { description: "Word count, sentence count, reading time" } },
      "/api/json-format": { price: "$0.001", network: "base", config: { description: "Format and validate JSON" } },
      "/api/base64": { price: "$0.001", network: "base", config: { description: "Base64 encode or decode" } },
      "/api/password-strength": { price: "$0.001", network: "base", config: { description: "Analyze password strength" } },
      "/api/hash": { price: "$0.001", network: "base", config: { description: "Generate MD5, SHA256, SHA512 hash" } },
    },
    facilitator
  )
);

// === AI ENDPOINTS (13) ===

app.post("/api/summarize", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const result = await callAI("Summarize this concisely:\n\n" + text);
    res.json({ result, endpoint: "summarize" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/translate", async (req, res) => {
  try {
    const { text, language } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const lang = language || "French";
    const result = await callAI("Translate to " + lang + ":\n\n" + text);
    res.json({ result, endpoint: "translate", language: lang });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/explain-code", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Missing code" });
    const result = await callAI("Explain this code in plain English:\n\n" + code);
    res.json({ result, endpoint: "explain-code" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/write", async (req, res) => {
  try {
    const { prompt, type } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });
    const result = await callAI("Write a " + (type || "general") + " based on:\n\n" + prompt);
    res.json({ result, endpoint: "write" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/analyze-sentiment", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const result = await callAI("Analyze sentiment. Reply in JSON with sentiment, confidence, summary:\n\n" + text);
    res.json({ result, endpoint: "analyze-sentiment" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "Missing question" });
    const result = await callAI(question);
    res.json({ result, endpoint: "chat" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/rewrite", async (req, res) => {
  try {
    const { text, tone } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const t = tone || "professional";
    const result = await callAI("Rewrite this text in a " + t + " tone. Keep the meaning but improve clarity and style:\n\n" + text);
    res.json({ result, endpoint: "rewrite", tone: t });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/proofread", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const result = await callAI("Proofread this text. Fix all grammar, spelling, and punctuation errors. Return the corrected version:\n\n" + text);
    res.json({ result, endpoint: "proofread" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/brainstorm", async (req, res) => {
  try {
    const { topic, count } = req.body;
    if (!topic) return res.status(400).json({ error: "Missing topic" });
    const n = count || 10;
    const result = await callAI("Brainstorm " + n + " creative and unique ideas about:\n\n" + topic);
    res.json({ result, endpoint: "brainstorm" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/eli5", async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ error: "Missing topic" });
    const result = await callAI("Explain this like I'm 5 years old. Use simple words and fun examples:\n\n" + topic);
    res.json({ result, endpoint: "eli5" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/extract-keywords", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const result = await callAI("Extract the most important keywords and key phrases from this text. Return them as a JSON array:\n\n" + text);
    res.json({ result, endpoint: "extract-keywords" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/generate-title", async (req, res) => {
  try {
    const { text, count } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const n = count || 5;
    const result = await callAI("Generate " + n + " catchy, engaging headlines/titles for this content:\n\n" + text);
    res.json({ result, endpoint: "generate-title" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/compare", async (req, res) => {
  try {
    const { item1, item2 } = req.body;
    if (!item1 || !item2) return res.status(400).json({ error: "Missing item1 or item2" });
    const result = await callAI("Compare these two things in detail with pros, cons, and a recommendation:\n\n1: " + item1 + "\n2: " + item2);
    res.json({ result, endpoint: "compare" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === UTILITY ENDPOINTS (5) - NO AI NEEDED ===

app.post("/api/text-stats", (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const words = text.trim().split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim()).length;
    const characters = text.length;
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim()).length || 1;
    const readingTimeMin = Math.ceil(words / 200);
    res.json({ words, sentences, characters, paragraphs, readingTimeMin, endpoint: "text-stats" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/json-format", (req, res) => {
  try {
    const { json, minify } = req.body;
    if (!json) return res.status(400).json({ error: "Missing json" });
    const parsed = typeof json === "string" ? JSON.parse(json) : json;
    const result = minify ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 2);
    res.json({ result, valid: true, endpoint: "json-format" });
  } catch (err) {
    res.json({ result: null, valid: false, error: err.message, endpoint: "json-format" });
  }
});

app.post("/api/base64", (req, res) => {
  try {
    const { text, action } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const act = action || "encode";
    let result;
    if (act === "decode") {
      result = Buffer.from(text, "base64").toString("utf-8");
    } else {
      result = Buffer.from(text).toString("base64");
    }
    res.json({ result, action: act, endpoint: "base64" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/password-strength", (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "Missing password" });
    let score = 0;
    const checks = {
      length8: password.length >= 8,
      length12: password.length >= 12,
      length16: password.length >= 16,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /[0-9]/.test(password),
      symbols: /[^A-Za-z0-9]/.test(password),
      noCommon: !["password", "123456", "qwerty", "admin", "letmein", "welcome"].includes(password.toLowerCase()),
    };
    Object.values(checks).forEach(v => { if (v) score += 12.5; });
    let strength = "very weak";
    if (score >= 75) strength = "strong";
    else if (score >= 50) strength = "medium";
    else if (score >= 25) strength = "weak";
    res.json({ score: Math.round(score), strength, checks, endpoint: "password-strength" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/hash", (req, res) => {
  try {
    const { text, algorithm } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    const algo = algorithm || "sha256";
    const validAlgos = ["md5", "sha256", "sha512"];
    if (!validAlgos.includes(algo)) return res.status(400).json({ error: "Invalid algorithm. Use: md5, sha256, sha512" });
    const hash = crypto.createHash(algo).update(text).digest("hex");
    res.json({ hash, algorithm: algo, endpoint: "hash" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === AGENT DISCOVERY ===

app.get("/.well-known/x402", (req, res) => {
  res.json({
    x402: true,
    version: 1,
    network: "base",
    facilitator: "https://x402.org/facilitator",
    payTo: WALLET_ADDRESS,
    endpoints: [
      { path: "/api/summarize", method: "POST", price: "$0.005", description: "Summarize text" },
      { path: "/api/translate", method: "POST", price: "$0.01", description: "Translate to any language" },
      { path: "/api/explain-code", method: "POST", price: "$0.01", description: "Explain code" },
      { path: "/api/write", method: "POST", price: "$0.02", description: "Generate content" },
      { path: "/api/analyze-sentiment", method: "POST", price: "$0.005", description: "Sentiment analysis" },
      { path: "/api/chat", method: "POST", price: "$0.01", description: "General Q&A" },
      { path: "/api/rewrite", method: "POST", price: "$0.01", description: "Improve/rewrite text" },
      { path: "/api/proofread", method: "POST", price: "$0.005", description: "Fix grammar and spelling" },
      { path: "/api/brainstorm", method: "POST", price: "$0.02", description: "Generate ideas" },
      { path: "/api/eli5", method: "POST", price: "$0.005", description: "Explain like I'm 5" },
      { path: "/api/extract-keywords", method: "POST", price: "$0.005", description: "Extract keywords" },
      { path: "/api/generate-title", method: "POST", price: "$0.005", description: "Generate headlines" },
      { path: "/api/compare", method: "POST", price: "$0.01", description: "Compare two things" },
      { path: "/api/text-stats", method: "POST", price: "$0.001", description: "Word count and reading time" },
      { path: "/api/json-format", method: "POST", price: "$0.001", description: "Format and validate JSON" },
      { path: "/api/base64", method: "POST", price: "$0.001", description: "Base64 encode/decode" },
      { path: "/api/password-strength", method: "POST", price: "$0.001", description: "Password strength analysis" },
      { path: "/api/hash", method: "POST", price: "$0.001", description: "Generate MD5/SHA256/SHA512 hash" },
    ],
  });
});

// === LLMs.txt - AI CRAWLER DISCOVERY ===

app.get("/llms.txt", (req, res) => {
  res.type("text/plain").send(`# x402 AI Gateway
> Pay-per-call AI and utility APIs powered by USDC micropayments on Base L2.

## Base URL
https://x402-ai-gateway.onrender.com

## Protocol
x402 (HTTP 402 Payment Required)
Payment: USDC on Base (EIP-155:8453)
Facilitator: https://x402.org/facilitator
PayTo: ${WALLET_ADDRESS}

## AI Endpoints (13)
- POST /api/summarize ($0.005) - Summarize text
- POST /api/translate ($0.01) - Translate to any language
- POST /api/explain-code ($0.01) - Explain code in plain English
- POST /api/write ($0.02) - Generate written content
- POST /api/analyze-sentiment ($0.005) - Sentiment analysis
- POST /api/chat ($0.01) - General Q&A
- POST /api/rewrite ($0.01) - Improve/rewrite text
- POST /api/proofread ($0.005) - Fix grammar and spelling
- POST /api/brainstorm ($0.02) - Generate creative ideas
- POST /api/eli5 ($0.005) - Explain like I'm 5
- POST /api/extract-keywords ($0.005) - Extract keywords
- POST /api/generate-title ($0.005) - Generate headlines
- POST /api/compare ($0.01) - Compare two things

## Utility Endpoints (5)
- POST /api/text-stats ($0.001) - Word count, reading time
- POST /api/json-format ($0.001) - JSON formatting and validation
- POST /api/base64 ($0.001) - Base64 encode/decode
- POST /api/password-strength ($0.001) - Password strength analysis
- POST /api/hash ($0.001) - MD5/SHA256/SHA512 hashing

## Discovery
- GET / - Landing page
- GET /api - JSON endpoint directory
- GET /.well-known/x402 - Machine-readable manifest
- GET /llms.txt - This file
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
.hero p{font-size:1.2em;color:#888;margin-bottom:30px}
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
.path{color:#fff;font-weight:500}
.desc{color:#888;font-size:0.85em}
.price{color:#16a34a;font-weight:bold;font-size:1.1em}
.section-label{text-align:center;color:#6366f1;font-size:0.85em;text-transform:uppercase;letter-spacing:2px;margin:30px 0 10px}
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
<p>Pay-per-call AI and utility APIs powered by USDC micropayments</p>
<div class="stats">
<div class="stat"><div class="num">18</div><div class="label">Endpoints</div></div>
<div class="stat"><div class="num">$0.001</div><div class="label">Starting Price</div></div>
<div class="stat"><div class="num">0%</div><div class="label">Platform Fees</div></div>
<div class="stat"><div class="num">USDC</div><div class="label">Base Network</div></div>
</div>
</div>
<div class="cta">
<a href="/api">API Directory (JSON)</a>
<a href="/.well-known/x402" class="secondary">Agent Discovery</a>
<a href="/llms.txt" class="secondary">llms.txt</a>
</div>
<div class="endpoints">
<h2>Available Endpoints</h2>
<div class="section-label">AI Endpoints</div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/summarize</span><span class="desc">Summarize text</span></div><span class="price">$0.005</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/translate</span><span class="desc">Translate to any language</span></div><span class="price">$0.01</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/explain-code</span><span class="desc">Explain code</span></div><span class="price">$0.01</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/write</span><span class="desc">Generate content</span></div><span class="price">$0.02</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/analyze-sentiment</span><span class="desc">Sentiment analysis</span></div><span class="price">$0.005</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/chat</span><span class="desc">General Q&A</span></div><span class="price">$0.01</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/rewrite</span><span class="desc">Improve/rewrite text</span></div><span class="price">$0.01</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/proofread</span><span class="desc">Fix grammar & spelling</span></div><span class="price">$0.005</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/brainstorm</span><span class="desc">Generate ideas</span></div><span class="price">$0.02</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/eli5</span><span class="desc">Explain like I'm 5</span></div><span class="price">$0.005</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/extract-keywords</span><span class="desc">Extract keywords</span></div><span class="price">$0.005</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/generate-title</span><span class="desc">Generate headlines</span></div><span class="price">$0.005</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/compare</span><span class="desc">Compare two things</span></div><span class="price">$0.01</span></div>
<div class="section-label">Utility Endpoints</div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/text-stats</span><span class="desc">Word count & reading time</span></div><span class="price">$0.001</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/json-format</span><span class="desc">Format & validate JSON</span></div><span class="price">$0.001</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/base64</span><span class="desc">Base64 encode/decode</span></div><span class="price">$0.001</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/password-strength</span><span class="desc">Password strength analysis</span></div><span class="price">$0.001</span></div>
<div class="endpoint"><div class="ep-left"><span class="method">POST</span><span class="path">/api/hash</span><span class="desc">MD5/SHA256/SHA512 hashing</span></div><span class="price">$0.001</span></div>
</div>
<div class="how">
<h2>How It Works</h2>
<div class="step"><h3>1. Call any endpoint</h3><p>Send a POST request to any endpoint above. You will get a <code>402 Payment Required</code> response with payment details.</p></div>
<div class="step"><h3>2. Pay with USDC</h3><p>Sign a USDC payment on <code>Base</code> network using the x402 protocol. No gas fees - the facilitator covers them.</p></div>
<div class="step"><h3>3. Get your result</h3><p>Resend your request with the payment proof in the <code>X-PAYMENT</code> header. Your AI result is returned instantly.</p></div>
</div>
<div class="footer">
<p>Powered by x402 Protocol | Payments on Base Network | USDC</p>
<p style="margin-top:8px">PayTo: <code>${WALLET_ADDRESS}</code></p>
</div>
</body>
</html>`);
});

// === DISCOVERY ENDPOINTS ===

app.get("/health", (req, res) => {
  res.json({ status: "online", network: "base", provider: AI_PROVIDER, endpoints: 18 });
});

app.get("/api", (req, res) => {
  res.json({
    name: "x402 AI Gateway",
    description: "AI and utility API endpoints, pay-per-call with USDC via x402",
    network: "base",
    payTo: WALLET_ADDRESS,
    aiEndpoints: [
      { method: "POST", path: "/api/summarize", price: "$0.005", description: "Summarize text" },
      { method: "POST", path: "/api/translate", price: "$0.01", description: "Translate to any language" },
      { method: "POST", path: "/api/explain-code", price: "$0.01", description: "Explain code in plain English" },
      { method: "POST", path: "/api/write", price: "$0.02", description: "Generate written content" },
      { method: "POST", path: "/api/analyze-sentiment", price: "$0.005", description: "Sentiment analysis" },
      { method: "POST", path: "/api/chat", price: "$0.01", description: "General Q&A" },
      { method: "POST", path: "/api/rewrite", price: "$0.01", description: "Improve/rewrite text" },
      { method: "POST", path: "/api/proofread", price: "$0.005", description: "Fix grammar & spelling" },
      { method: "POST", path: "/api/brainstorm", price: "$0.02", description: "Generate creative ideas" },
      { method: "POST", path: "/api/eli5", price: "$0.005", description: "Explain like I'm 5" },
      { method: "POST", path: "/api/extract-keywords", price: "$0.005", description: "Extract keywords" },
      { method: "POST", path: "/api/generate-title", price: "$0.005", description: "Generate headlines" },
      { method: "POST", path: "/api/compare", price: "$0.01", description: "Compare two things" },
    ],
    utilityEndpoints: [
      { method: "POST", path: "/api/text-stats", price: "$0.001", description: "Word count and reading time" },
      { method: "POST", path: "/api/json-format", price: "$0.001", description: "Format and validate JSON" },
      { method: "POST", path: "/api/base64", price: "$0.001", description: "Base64 encode/decode" },
      { method: "POST", path: "/api/password-strength", price: "$0.001", description: "Password strength analysis" },
      { method: "POST", path: "/api/hash", price: "$0.001", description: "MD5/SHA256/SHA512 hashing" },
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
  console.log("  x402 AI GATEWAY - RUNNING");
  console.log("  http://localhost:" + PORT);
  console.log("  Network: Base Mainnet");
  console.log("  AI: " + AI_PROVIDER);
  console.log("  Paid endpoints: 18 (13 AI + 5 utility)");
  console.log("  Wallet: " + WALLET_ADDRESS);
  console.log("==========================================");
});