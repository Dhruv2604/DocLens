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

## Architecture

```text
Browser
  │
  ├── PDF → PDF.js → extracted text
  │
  └── Image/scanned PDF → Tesseract.js → OCR text
                    │
                    ▼
             /api/summarize
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
   Gemini API available   No API key
          │                   │
          ▼                   ▼
     AI JSON summary     Local fallback
          │                   │
          └─────────┬─────────┘
                    ▼
              Result UI
```

## Run locally

1. Install Node.js and Vercel CLI if needed:

```bash
npm install -g vercel
```

2. From the project folder:

```bash
vercel dev
```

3. For AI summaries, create a `.env.local` file:

```env
GEMINI_API_KEY=your_key_here
```

Do not commit `.env.local`.

## Deploy to Vercel

### Option A — GitHub

1. Create a new GitHub repository.
2. Upload every file/folder from this project.
3. Go to Vercel and import the GitHub repository.
4. Keep the framework preset as `Other` if Vercel asks.
5. Add an environment variable:
   - Name: `GEMINI_API_KEY`
   - Value: your Gemini API key
6. Deploy.

No API key is required for the fallback summary, but Gemini is recommended for the full smart-summary experience.

### Option B — Vercel CLI

```bash
vercel
```

For production:

```bash
vercel --prod
```

## Important security note

Never put the Gemini API key inside `app.js`, `index.html`, or any client-side file. The key belongs only in Vercel Environment Variables.

## Testing checklist

- [ ] Upload a normal text PDF.
- [ ] Upload a scanned/image PDF.
- [ ] Upload a PNG/JPG document.
- [ ] Try drag-and-drop.
- [ ] Try an unsupported file.
- [ ] Try a file above 15 MB.
- [ ] Test short/medium/long summaries.
- [ ] Test with `GEMINI_API_KEY` configured.
- [ ] Test the fallback without the key.
- [ ] Test on a phone-sized screen.
- [ ] Verify the GitHub repository does not contain `.env.local`.

## Assessment alignment

The implementation covers the assignment's stated requirements for document upload, PDF parsing, OCR, smart summary generation, summary-length choices, key points, improvement suggestions, responsive UI, loading/error handling, documentation, GitHub delivery, and Vercel hosting.

## Tech stack

- HTML5 / CSS3 / JavaScript
- PDF.js
- Tesseract.js
- Gemini API
- Vercel Serverless Functions
