# Deployment Checklist

## GitHub
- [ ] Create a new repository.
- [ ] Upload all files in this folder.
- [ ] Make sure `.env.local` is NOT uploaded.
- [ ] Confirm the `api` folder is visible in GitHub.

## Vercel
- [ ] Import the GitHub repository.
- [ ] Add `GEMINI_API_KEY` under Environment Variables.
- [ ] Deploy.
- [ ] Open the generated `.vercel.app` URL.
- [ ] Test PDF upload.
- [ ] Test image/OCR upload.
- [ ] Test all three summary lengths.

## Before submission
- [ ] Copy the live Vercel URL.
- [ ] Copy the GitHub repository URL.
- [ ] Include the repository README.
- [ ] Do not expose the Gemini API key.
