import express from "express";
import { paymentMiddleware } from "x402-express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const WALLET_ADDRESS = "0x2C9297896F609718Fd2FeECFaCA019CFD8d2d1B7";
const PORT = process.env.PORT || 3000;
const AI_PROVIDER = process.env.AI_PROVIDER || "openrouter";
const facilitator = { url: process.env.FACILITATOR_URL || "https://x402.org/facilitator" };

// === FREE AI PROVIDERS ===

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

// === x402 PAYMENT MIDDLEWARE (13 PAID ENDPOINTS) ===

app.use(
  paymentMiddleware(
    WALLET_ADDRESS,
    {
      "/api/summarize": {
        price: "$0.01",
        network: "base-sepolia",
        config: { description: "Summarize any text into key points" },
      },
      "/api/translate": {
        price: "$0.02",
        network: "base-sepolia",
        config: { description: "Translate text to any language" },
      },
      "/api/explain-code": {
        price: "$0.02",
        network: "base-sepolia",
        config: { description: "Explain what code does in plain English" },
      },
      "/api/write": {
        price: "$0.03",
        network: "base-sepolia",
        config: { description: "Generate written content" },
      },
      "/api/analyze-sentiment": {
        price: "$0.01",
        network: "base-sepolia",
        config: { description: "Analyze the sentiment of text" },
      },
      "/api/chat": {
        price: "$0.02",
        network: "base-sepolia",
        config: { description: "General Q&A - ask anything" },
      },
      "/api/rewrite": {
        price: "$0.02",
        network: "base-sepolia",
        config: { description: "Improve and rewrite text professionally" },
      },
      "/api/proofread": {
        price: "$0.01",
        network: "base-sepolia",
        config: { description: "Fix grammar, spelling, and punctuation" },
      },
      "/api/brainstorm": {
        price: "$0.03",
        network: "base-sepolia",
        config: { description: "Generate creative ideas on any topic" },
      },
      "/api/eli5": {
        price: "$0.01",
        network: "base-sepolia",
        config: { description: "Explain anything like I'm 5 years old" },
      },
      "/api/extract-keywords": {
        price: "$0.01",
        network: "base-sepolia",
        config: { description: "Extract keywords and key phrases from text" },
      },
      "/api/generate-title": {
        price: "$0.01",
        network: "base-sepolia",
        config: { description: "Generate catchy headlines and titles" },
      },
      "/api/compare": {
        price: "$0.02",
        network: "base-sepolia",
        config: { description: "Compare two things with pros and cons" },
      },
    },
    facilitator
  )
);

// === ORIGINAL 5 PAID ENDPOINTS ===

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

// === 8 NEW PAID ENDPOINTS ===

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

// === FREE ENDPOINTS ===

app.get("/health", (req, res) => {
  res.json({ status: "online", network: "base-sepolia", provider: AI_PROVIDER, endpoints: 13 });
});

app.get("/api", (req, res) => {
  res.json({
    name: "x402 AI Gateway",
    description: "AI API endpoints, pay-per-call with USDC via x402",
    network: "base-sepolia",
    payTo: WALLET_ADDRESS,
    endpoints: [
      { method: "POST", path: "/api/summarize", price: "$0.01", description: "Summarize text" },
      { method: "POST", path: "/api/translate", price: "$0.02", description: "Translate to any language" },
      { method: "POST", path: "/api/explain-code", price: "$0.02", description: "Explain code in plain English" },
      { method: "POST", path: "/api/write", price: "$0.03", description: "Generate written content" },
      { method: "POST", path: "/api/analyze-sentiment", price: "$0.01", description: "Sentiment analysis" },
      { method: "POST", path: "/api/chat", price: "$0.02", description: "General Q&A" },
      { method: "POST", path: "/api/rewrite", price: "$0.02", description: "Improve/rewrite text" },
      { method: "POST", path: "/api/proofread", price: "$0.01", description: "Fix grammar & spelling" },
      { method: "POST", path: "/api/brainstorm", price: "$0.03", description: "Generate creative ideas" },
      { method: "POST", path: "/api/eli5", price: "$0.01", description: "Explain like I'm 5" },
      { method: "POST", path: "/api/extract-keywords", price: "$0.01", description: "Extract keywords" },
      { method: "POST", path: "/api/generate-title", price: "$0.01", description: "Generate headlines" },
      { method: "POST", path: "/api/compare", price: "$0.02", description: "Compare two things" },
    ],
    free: [
      { method: "GET", path: "/health" },
      { method: "GET", path: "/api" },
    ],
  });
});

// === START ===

app.listen(PORT, () => {
  console.log("==========================================");
  console.log("  x402 AI GATEWAY - RUNNING");
  console.log("  http://localhost:" + PORT);
  console.log("  Network: Base Sepolia");
  console.log("  AI: " + AI_PROVIDER);
  console.log("  Paid endpoints: 13");
  console.log("  Wallet: " + WALLET_ADDRESS);
  console.log("==========================================");
});