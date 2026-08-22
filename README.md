Live: https://xdoclens.vercel.app

# DocLens

A production-style document analysis web app for the Software Engineering technical assessment.

The assignment asks for PDF/image upload, text extraction, OCR for scanned documents, smart summaries with short/medium/long options, key points, improvement suggestions, responsive UI, error handling, loading states, documentation, GitHub source code, and a hosted application. This implementation is designed to deploy directly to Vercel.

## Features

- PDF upload with PDF.js text extraction.
- Scanned-image OCR using Tesseract.js.
- OCR fallback for scanned PDFs that contain little/no selectable text.
- Short, medium, and long summary modes.
- AI summaries using Gemini through a Vercel serverless function.
- Deterministic extractive fallback when `GEMINI_API_KEY` is not configured.
- Key points and improvement suggestions.
- Drag-and-drop + file picker.
- File validation and 15 MB client-side limit.
- Loading/progress states.
- Copy-summary button.
- Mobile-responsive UI.
- API key stays server-side; it is never placed in browser code.

## Assessment alignment

The implementation covers the assignment's stated requirements for document upload, PDF parsing, OCR, smart summary generation, summary-length choices, key points, improvement suggestions, responsive UI, loading/error handling, documentation, GitHub delivery, and Vercel hosting.

## Tech stack

- HTML5 / CSS3 / JavaScript
- PDF.js
- Tesseract.js
- Gemini API
- Vercel Serverless Functions
