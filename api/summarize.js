const MODEL = "gemini-3.7-flash";

const lengthInstructions = {
  short: "Keep the summary to about 100–150 words.",
  medium: "Keep the summary to about 200–300 words.",
  long: "Keep the summary to about 350–500 words."
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
      // A deterministic fallback keeps the deployed app usable even before
      // the optional Gemini API key is configured.
      return res.status(200).json(buildFallbackSummary(text, filename, length));
    }

    const prompt = `
You are DocLens, a careful document analyst.

Analyze ONLY the document text supplied below. Do not invent facts, statistics,
names, dates, or conclusions that are not supported by the text.

Return valid JSON with exactly these fields:
{
  "title": "short descriptive title",
  "summary": "coherent summary",
  "keyPoints": ["3 to 6 concise points"],
  "suggestions": ["3 to 5 practical improvement suggestions"]
}

${lengthInstructions[length] || lengthInstructions.medium}
The summary should capture the document's main purpose, important findings,
decisions, requirements, or conclusions. Suggestions should focus on clarity,
structure, missing context, evidence, or actionable improvements that are
reasonable from the document itself.

Document filename: ${filename}

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
            temperature: 0.2,
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

    if (!raw) {
      return res.status(502).json({ error: "The AI service returned an empty response." });
    }

    const parsed = safeJsonParse(raw);

    if (!parsed || typeof parsed !== "object") {
      return res.status(502).json({ error: "The AI service returned an invalid summary format." });
    }

    return res.status(200).json({
      title: parsed.title || filename,
      summary: parsed.summary || "No summary was generated.",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.slice(0, 6) : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : []
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
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function buildFallbackSummary(text, filename, length) {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);

  const target = length === "short" ? 3 : length === "long" ? 8 : 5;
  const selected = selectRepresentativeSentences(sentences, target);

  const pointSource = selected.length ? selected : sentences.slice(0, target);
  const keyPoints = pointSource.slice(0, 6).map(trimSentence);

  const suggestions = [
    "Add a clear one-paragraph executive takeaway if the document is intended for quick review.",
    "Use descriptive headings and short sections to make important information easier to scan.",
    "Support important claims with sources, evidence, dates, or measurable outcomes where available."
  ];

  return {
    title: filename.replace(/\.[^/.]+$/, "") || "Document summary",
    summary: selected.join(" ") || text.slice(0, 1200),
    keyPoints,
    suggestions
  };
}

function selectRepresentativeSentences(sentences, count) {
  if (sentences.length <= count) return sentences;
  const step = (sentences.length - 1) / (count - 1);
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(sentences[Math.round(i * step)]);
  }
  return [...new Set(result)];
}

function trimSentence(sentence) {
  const clean = sentence.replace(/\s+/g, " ").trim();
  return clean.length > 180 ? `${clean.slice(0, 177)}…` : clean;
}
