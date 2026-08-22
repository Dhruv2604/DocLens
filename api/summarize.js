const MODEL = "gemini-3.7-flash";

const lengthInstructions = {
  short: "Write a tight 80–120 word executive summary.",
  medium: "Write a clear 140–200 word executive summary.",
  long: "Write a detailed 220–320 word executive summary."
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const { text, length = "medium", filename = "document" } = req.body || {};

    if (!text || typeof text !== "string" || text.trim().length < 30) {
      return res.status(400).json({ error: "The extracted document text is too short to summarize." });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(200).json(buildFallbackSummary(text, filename, length));
    }

    const prompt = `
You are DocLens, a professional document intelligence assistant.

Your job is to turn raw extracted document text into a genuinely useful executive
summary. The input may be a resume, report, article, assignment, proposal, notes,
research paper, policy, or business document.

IMPORTANT:
- Do NOT simply repeat or lightly reformat the source text.
- Do NOT copy contact details, URLs, email addresses, phone numbers, or long lists
  unless they are essential to understanding the document.
- Remove duplicated phrases caused by PDF extraction.
- Do not invent facts.
- Prioritize purpose, major themes, strongest findings, important requirements,
  achievements, decisions, conclusions, or implications.
- For a resume, summarize the candidate's profile, strongest skills, experience,
  projects/achievements, and overall positioning — not their contact information.
- For a report/article, summarize the problem, main findings, evidence, and conclusion.
- Write like an executive brief: concise, natural, polished, and easy to scan.

Return ONLY valid JSON:
{
  "title": "3–7 word descriptive title",
  "summary": "A polished executive summary in 2–4 short paragraphs.",
  "keyPoints": [
    "A meaningful takeaway",
    "A second meaningful takeaway",
    "A third meaningful takeaway",
    "Optional fourth takeaway"
  ],
  "suggestions": [
    "A practical improvement",
    "A second practical improvement",
    "A third practical improvement"
  ]
}

${lengthInstructions[length] || lengthInstructions.medium}

The "summary" must be a synthesis, not a transcript. Each key point should add
information rather than repeating the summary. Suggestions should be specific to
the document type and content.

Filename: ${filename}

DOCUMENT TEXT:
${text}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.15,
            responseMimeType: "application/json"
          }
        })
      }
    );

    const payload = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", payload);
      return res.status(502).json({
        error: "The AI summary service returned an error. Please verify your Gemini API key and try again."
      });
    }

    const raw = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    const parsed = safeJsonParse(raw);

    if (!parsed || typeof parsed !== "object") {
      return res.status(502).json({ error: "The AI service returned an invalid summary format." });
    }

    return res.status(200).json({
      title: cleanTitle(parsed.title, filename),
      summary: cleanSummary(parsed.summary),
      keyPoints: cleanList(parsed.keyPoints, 5),
      suggestions: cleanList(parsed.suggestions, 4)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unexpected server error while generating the summary." });
  }
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}

function cleanTitle(title, filename) {
  const fallback = filename.replace(/\.[^/.]+$/, "") || "Document summary";
  return String(title || fallback).replace(/\s+/g, " ").trim().slice(0, 70);
}

function cleanSummary(summary) {
  return String(summary || "No summary was generated.")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanList(list, max) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => String(item).replace(/\s+/g, " ").trim())
    .filter((item) => item.length > 10)
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .slice(0, max);
}

function buildFallbackSummary(text, filename, length) {
  const clean = text
    .replace(/\s+/g, " ")
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .trim();

  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 35);

  const count = length === "short" ? 3 : length === "long" ? 7 : 5;
  const selected = selectRepresentativeSentences(sentences, count);

  const keyPoints = selected.slice(0, 5).map(trimSentence);

  return {
    title: filename.replace(/\.[^/.]+$/, "") || "Document summary",
    summary: selected.length
      ? selected.join(" ")
      : "The document contains text that could not be condensed reliably without an AI model.",
    keyPoints,
    suggestions: [
      "Add a concise executive takeaway near the beginning for faster review.",
      "Group related information under descriptive headings to improve scanability.",
      "Support important claims with evidence, dates, metrics, or sources where appropriate."
    ]
  };
}

function selectRepresentativeSentences(sentences, count) {
  if (sentences.length <= count) return sentences;
  const result = [];
  for (let i = 0; i < count; i++) {
    const index = Math.round((i * (sentences.length - 1)) / (count - 1));
    result.push(sentences[index]);
  }
  return [...new Set(result)];
}

function trimSentence(sentence) {
  const clean = sentence.replace(/\s+/g, " ").trim();
  return clean.length > 170 ? `${clean.slice(0, 167)}…` : clean;
}
