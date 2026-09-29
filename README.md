# Audio Transcriptor

A full-stack speech-to-text application. Users record or upload audio, get a live transcription, and can revisit past transcriptions from their history.

## Live Demo

[audio-transcriptor-rouge.vercel.app](https://audio-transcriptor-rouge.vercel.app)

## Architecture

```
┌─────────────┐        HTTPS         ┌──────────────┐        HTTPS        ┌───────────┐
│   React      │  ───────────────▶   │   Backend    │  ─────────────────▶ │ Deepgram  │
│   Frontend   │  ◀───────────────   │   [FastAPI/   │  ◀───────────────── │   STT API │
│  (Vite)      │      JSON           │   Flask/Node] │      transcript     └───────────┘
└─────────────┘                      └──────────────┘
                                            │
                                            ▼
                                   [Database / storage layer]
                                   (transcription history)
```

## Tech Stack

**Frontend**
- React.js (Vite)
- Tailwind CSS, Styled Components
- React Router DOM

**Backend**
- FastAPI
- Deepgram SDK (server-side only — never exposed to the client)

**Infra**
- Frontend deployed on Vercel
- Backend deployed on Render`

## Features

- Record audio from the microphone or upload a file
- Real-time speech-to-text transcription via Deepgram

## API Reference

> Fill this in with your real endpoints. Example shape:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/transcribe` | Accepts an audio file/stream, returns transcript text |
| `GET`  | `/api/transcripts` | Returns paginated history of past transcriptions |
| `GET`  | `/api/transcripts/:id` | Returns a single transcript by ID |
| `DELETE` | `/api/transcripts/:id` | Deletes a transcript |

## Getting Started

### Prerequisites
- Python 3.11+
- A Deepgram API key ([get one here](https://deepgram.com))

### 1. Clone the repo
```bash
git clone https://github.com/Ameyak17901/audio-transcriptor.git
cd audio-transcriptor
```

### 2. Backend setup
```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in `backend/`:
```
DEEPGRAM_API_KEY=<your-key>
DATABASE_URL=<your-db-connection-string>
```

Run the backend:
```bash
uvicorn main:app --reload
```

### 3. Frontend setup
```bash
cd ..
npm install
```

Create a `.env` file in the project root:
```
VITE_API_BASE_URL=http://localhost:8000
```
> Note: the Deepgram key does **not** belong in the frontend `.env` — it lives only in the backend now.

Run the frontend:
```bash
npm run dev
```

## Project Structure

```
audio-transcriptor/
├── backend/
│   ├── [entrypoint file]
│   ├── [routes/]
│   ├── [models/ or schema]
│   └── requirements.txt / package.json
├── src/
│   ├── components/
│   ├── pages/
│   └── ...
├── public/
├── Dockerfile
└── render.yaml
```

## Roadmap

- [ ] Move Deepgram calls fully server-side (remove key from frontend build)
- [ ] Add unit tests for backend endpoints
- [ ] Add rate limiting on `/api/transcribe`
- [ ] Add pagination to transcript history
- [ ] Add structured logging / basic observability
