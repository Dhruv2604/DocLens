import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const $ = (id) => document.getElementById(id);

const dropZone = $("dropZone");
const fileInput = $("fileInput");
const browseBtn = $("browseBtn");
const fileCard = $("fileCard");
const fileName = $("fileName");
const fileInfo = $("fileInfo");
const fileIcon = $("fileIcon");
const removeFileBtn = $("removeFileBtn");
const summaryLength = $("summaryLength");
const summarizeBtn = $("summarizeBtn");
const summarizeText = $("summarizeText");
const spinner = $("spinner");
const progressBox = $("progressBox");
const progressLabel = $("progressLabel");
const progressPercent = $("progressPercent");
const progressBar = $("progressBar");
const errorBox = $("errorBox");
const emptyState = $("emptyState");
const result = $("result");
const copyBtn = $("copyBtn");
const resultTitle = $("resultTitle");
const wordCount = $("wordCount");
const summaryContent = $("summaryContent");
const keyPoints = $("keyPoints");
const suggestions = $("suggestions");
const sourceName = $("sourceName");
const sourceMethod = $("sourceMethod");

let selectedFile = null;
let extractedText = "";
let extractionMethod = "";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_TEXT_FOR_API = 70000;

browseBtn.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("click", (event) => {
  if (!event.target.closest("button")) fileInput.click();
});
dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") fileInput.click();
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) selectFile(fileInput.files[0]);
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
});

dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files[0];
  if (file) selectFile(file);
});

removeFileBtn.addEventListener("click", resetFile);
summarizeBtn.addEventListener("click", generateSummary);
copyBtn.addEventListener("click", copyResult);

function selectFile(file) {
  clearError();

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = file.type.startsWith("image/");

  if (!isPdf && !isImage) {
    showError("Please upload a PDF or an image file (PNG, JPG, JPEG, or WEBP).");
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    showError("This file is larger than 15 MB. Please upload a smaller document.");
    return;
  }

  selectedFile = file;
  fileName.textContent = file.name;
  fileInfo.textContent = formatBytes(file.size);
  fileIcon.textContent = isPdf ? "PDF" : "IMG";
  fileCard.classList.remove("hidden");
  summarizeBtn.disabled = false;
  result.classList.add("hidden");
  emptyState.classList.remove("hidden");
  copyBtn.classList.add("hidden");
}

async function generateSummary() {
  if (!selectedFile) return;

  clearError();
  setLoading(true);
  setProgress(5, "Preparing document…");

  try {
    const isPdf = selectedFile.type === "application/pdf" ||
      selectedFile.name.toLowerCase().endsWith(".pdf");

    extractedText = isPdf
      ? await extractPdfText(selectedFile)
      : await extractImageText(selectedFile);

    if (!extractedText || extractedText.trim().length < 30) {
      throw new Error(
        "Not enough readable text was found. For scanned documents, use a clearer image or higher-resolution scan."
      );
    }

    const normalized = extractedText.replace(/\s+/g, " ").trim();
    const apiText = normalized.slice(0, MAX_TEXT_FOR_API);

    setProgress(75, "Generating smart summary…");

    const response = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: apiText,
        length: summaryLength.value,
        filename: selectedFile.name
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "The summary service could not process this document.");
    }

    setProgress(100, "Complete");
    renderResult(data, selectedFile.name, extractionMethod);
  } catch (error) {
    console.error(error);
    showError(error.message || "Something went wrong while processing the document.");
  } finally {
    setLoading(false);
  }
}

async function extractPdfText(file) {
  extractionMethod = "PDF.js text extraction";
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = "";

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    text += `\n${pageText}\n`;

    const percent = Math.min(68, 8 + Math.round((pageNumber / pdf.numPages) * 60));
    setProgress(percent, `Reading PDF page ${pageNumber} of ${pdf.numPages}…`);
  }

  if (text.trim().length >= 30) return text;

  // PDF may be scanned. Render the first few pages and run OCR as a fallback.
  extractionMethod = "PDF.js + Tesseract OCR";
  let ocrText = "";
  const pagesForOcr = Math.min(pdf.numPages, 8);

  for (let pageNumber = 1; pageNumber <= pagesForOcr; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");

    await page.render({ canvasContext: context, viewport }).promise;

    const { data } = await Tesseract.recognize(canvas, "eng", {
      logger: (message) => {
        if (message.status === "recognizing text") {
          const base = 8 + Math.round((pageNumber / pagesForOcr) * 60);
          setProgress(Math.min(68, base), `OCR page ${pageNumber} of ${pagesForOcr}…`);
        }
      }
    });

    ocrText += `\n${data.text}\n`;
  }

  return ocrText;
}

async function extractImageText(file) {
  extractionMethod = "Tesseract.js OCR";
  const { data } = await Tesseract.recognize(file, "eng", {
    logger: (message) => {
      if (message.status === "recognizing text" && typeof message.progress === "number") {
        const percent = Math.round(8 + message.progress * 60);
        setProgress(percent, "Reading image with OCR…");
      }
    }
  });
  return data.text;
}

function renderResult(data, filename, method) {
  emptyState.classList.add("hidden");
  result.classList.remove("hidden");
  copyBtn.classList.remove("hidden");

  resultTitle.textContent = data.title || "Document summary";
  summaryContent.textContent = data.summary || "No summary returned.";
  wordCount.textContent = `${countWords(data.summary || "")} words`;

  keyPoints.innerHTML = "";
  (data.keyPoints || []).forEach((point) => {
    const li = document.createElement("li");
    li.textContent = point;
    keyPoints.appendChild(li);
  });

  suggestions.innerHTML = "";
  (data.suggestions || []).forEach((suggestion) => {
    const li = document.createElement("li");
    li.textContent = suggestion;
    suggestions.appendChild(li);
  });

  sourceName.textContent = filename;
  sourceMethod.textContent = method;
}

async function copyResult() {
  const points = [...keyPoints.querySelectorAll("li")].map((li) => `• ${li.textContent}`).join("\n");
  const tips = [...suggestions.querySelectorAll("li")].map((li) => `• ${li.textContent}`).join("\n");
  const text = `${resultTitle.textContent}\n\n${summaryContent.textContent}\n\nKey points\n${points}\n\nImprovement suggestions\n${tips}`;

  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "Copied";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
  } catch {
    showError("Copy was blocked by the browser. Please select and copy the summary manually.");
  }
}

function resetFile() {
  selectedFile = null;
  extractedText = "";
  extractionMethod = "";
  fileInput.value = "";
  fileCard.classList.add("hidden");
  summarizeBtn.disabled = true;
  result.classList.add("hidden");
  emptyState.classList.remove("hidden");
  copyBtn.classList.add("hidden");
  clearError();
  setProgress(0, "Processing…");
}

function setLoading(loading) {
  summarizeBtn.disabled = loading || !selectedFile;
  spinner.classList.toggle("hidden", !loading);
  summarizeText.textContent = loading ? "Processing…" : "Generate summary";
  progressBox.classList.toggle("hidden", !loading);
}

function setProgress(percent, label) {
  progressBox.classList.remove("hidden");
  progressBar.style.width = `${percent}%`;
  progressPercent.textContent = `${percent}%`;
  progressLabel.textContent = label;
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function countWords(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}
