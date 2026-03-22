# Project Spec: Local LLM with Google Maps Integration

**Version:** 1.2  
**Stack:** JavaScript (Node.js + Fastify) · Ollama · Open WebUI · Google Maps API (Static Maps API)  
**Target:** AI agent implementation guide - read this fully before writing any code.

---

## 1. Project Overview

Build a system where a user chats with a locally-running LLM (via Open WebUI), asks about places (restaurants, ATMs, hotels, etc.), and the LLM responds with an embedded Google Map showing the location - including a clickable link to open directions in Google Maps.

The system has three layers:
1. **Open WebUI** - chat interface, runs locally in Docker
2. **Ollama** - runs the LLM locally (no cloud LLM calls)
3. **Fastify backend** - the only component that talks to Google Maps API

---

## 2. Folder Structure

```
llm-maps-project/
├── backend/
│   ├── src/
│   │   ├── server.js            # Fastify app entry point, registers plugins + routes
│   │   ├── routes/
│   │   │   └── maps.js          # Route: POST /api/search-place
│   │   ├── services/
│   │   │   └── gmaps.js         # Google Maps API calls (Places + URL builder)
│   │   └── plugins/
│   │       └── rateLimit.js     # Rate limiting + CORS plugin registration
│   ├── .env                     # Secret keys - NEVER commit this file
│   ├── .env.example             # Template for .env (commit this)
│   ├── package.json             # Node dependencies
│   ├── package-lock.json        # Lock file (commit this)
│   └── Dockerfile               # Node 20 Alpine image
├── openwebui/
│   ├── tools/
│   │   └── maps_tool.py         # Open WebUI Tool definition (must be Python per Open WebUI spec)
│   └── prompts/
│       └── system.md            # System prompt instructing LLM when to use the tool
├── docs/
│   ├── spec.md                  # This file
│   └── ASSUMPTIONS.md           # Assumptions made during implementation
├── .gitignore                   # Must include: .env, node_modules/, .DS_Store
└── docker-compose.yml           # Runs: Ollama + Open WebUI + Fastify backend
```

> **Note:** Open WebUI Tools must be written in Python (Open WebUI's plugin system requirement).
> The backend API - where all the real logic lives - is fully JavaScript/Node.js.

---

## 3. Component Specifications

---

### 3.1 Fastify Backend (`backend/`)

#### `src/server.js`

```javascript
import Fastify from 'fastify'
import dotenv from 'dotenv'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import mapsRoute from './routes/maps.js'

dotenv.config()

const fastify = Fastify({ logger: true })

// CORS - only allow Open WebUI origin
await fastify.register(cors, {
  origin: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
  methods: ['POST', 'GET']
})

// Rate limiting - 10 requests per minute per IP
await fastify.register(rateLimit, {
  max: 10,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    error: 'Rate limit exceeded. Try again later.'
  })
})

// Routes
await fastify.register(mapsRoute, { prefix: '/api' })

// Start
const start = async () => {
  try {
    await fastify.listen({ port: 8000, host: '0.0.0.0' })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
```

#### `src/routes/maps.js`

```javascript
import { searchPlace } from '../services/gmaps.js'

export default async function mapsRoute(fastify) {
  // JSON Schema for request validation (Fastify built-in)
  const schema = {
    body: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', minLength: 1 },
        location: { type: 'string', default: '' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          place_name: { type: 'string' },
          address: { type: 'string' },
          maps_embed_url: { type: 'string' },
          maps_link: { type: 'string' },
          lat: { type: 'number' },
          lng: { type: 'number' }
        }
      }
    }
  }

  fastify.post('/search-place', { schema }, async (request, reply) => {
    const { query, location = '' } = request.body

    const result = await searchPlace(query, location)

    if (!result) {
      return reply.status(404).send({ error: 'No places found for query' })
    }

    return result
  })
}
```

Fastify automatically returns `400` with a validation error message if `query` is missing or empty - no manual check needed because of the JSON Schema above.

#### `src/services/gmaps.js`

```javascript
// This is the ONLY file that touches the Google Maps API key.
// Key is read from environment - never hardcoded, never logged.

const PLACES_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
const EMBED_BASE = 'https://www.google.com/maps/embed/v1/place'

export async function searchPlace(query, location = '') {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  const searchQuery = location ? `${query} ${location}` : query

  const params = new URLSearchParams({
    query: searchQuery,
    key: apiKey,
    language: 'en' 
  })

  const response = await fetch(`${PLACES_URL}?${params}`)
  const data = await response.json()

  if (data.status !== 'OK' || !data.results?.length) {
    return null
  }

  const place = data.results[0]
  const { lat, lng } = place.geometry.location
  const placeId = place.place_id

  const mapsEmbedUrl = `${EMBED_BASE}?key=${apiKey}&q=place_id:${placeId}`
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${placeId}`

  return {
    place_name: place.name,
    address: place.formatted_address,
    maps_embed_url: mapsEmbedUrl,
    maps_link: mapsLink,
    lat,
    lng
  }
}
```

> `fetch` is available natively in Node.js 18+. No need for `axios`.

#### `package.json`

```json
{
  "name": "llm-maps-backend",
  "version": "1.0.0",
  "type": "module",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js"
  },
  "dependencies": {
    "fastify": "^4.27.0",
    "@fastify/cors": "^9.0.1",
    "@fastify/rate-limit": "^9.1.0",
    "dotenv": "^16.4.5"
  }
}
```

#### `.env` (DO NOT COMMIT)

```
GOOGLE_MAPS_API_KEY=your_actual_key_here
ALLOWED_ORIGINS=http://localhost:3000
```

#### `.env.example` (COMMIT THIS)

```
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
ALLOWED_ORIGINS=http://localhost:3000
```

#### `Dockerfile`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 8000
CMD ["node", "src/server.js"]
```

> Use `npm ci` (not `npm install`) in Docker - it's faster and uses the exact lock file versions.

---

### 3.2 Open WebUI Tool (`openwebui/tools/maps_tool.py`)

> Open WebUI's plugin/tool system only supports Python. This is the one Python file in the project.
> It acts as a thin HTTP client that calls your Fastify backend - no Google Maps logic here.

```python
"""
title: Google Maps Place Search
author: Gusti
description: Search for places and return a static map image with directions link
version: 0.2.0
"""

import requests
from pydantic import BaseModel

class Tools:
    class Valves(BaseModel):
        BACKEND_URL: str = "http://backend:8000"  # Docker service name
        GOOGLE_MAPS_API_KEY: str = ""

    def __init__(self):
        self.valves = self.Valves()

    def search_place(self, query: str, location: str = "") -> str:
        """
        Search for a place and return a static Google Maps image with directions link.
        Use this when the user asks about places to go, eat, visit, or find.
        :param query: The place type or name to search for
        :param location: Optional city or area to narrow the search
        :return: Markdown string with static map image and directions link
        """
        try:
            response = requests.post(
                f"{self.valves.BACKEND_URL}/api/search-place",
                json={"query": query, "location": location},
                timeout=10
            )
            data = response.json()

            if response.status_code != 200:
                return f"Sorry, I couldn't find that place: {data.get('error', 'Unknown error')}"

            lat = data['lat']
            lng = data['lng']
            place_name = data['place_name']
            address = data['address']
            maps_link = data['maps_link']
            directions_link = f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}"

            static_map = (
                f"https://maps.googleapis.com/maps/api/staticmap"
                f"?center={lat},{lng}"
                f"&zoom=15"
                f"&size=600x300"
                f"&markers=color:red%7Clabel:P%7C{lat},{lng}"
                f"&key={self.valves.GOOGLE_MAPS_API_KEY}"
            )

            return f"""**{place_name}**
{address}

[![Map of {place_name}]({static_map})]({maps_link})

[Open in Google Maps]({maps_link}) | [Get Directions]({directions_link})""".strip()

        except Exception as e:
            return f"Map search failed: {str(e)}"
```

**How to register in Open WebUI:**
1. Open `http://localhost:3000` → Settings → Tools
2. Click "+" to create new tool
3. Paste the full contents of `maps_tool.py`
4. Save and enable for the active model

---

### 3.3 System Prompt (`openwebui/prompts/system.md`)

Paste this into Open WebUI → Settings → Models → (your model) → System Prompt:

```
You are a helpful local assistant. When users ask about places - such as restaurants,
cafes, hotels, ATMs, hospitals, or any location - you MUST use the search_place tool
to find the location and display the map. But please do not say "search_place" in front of user, just say google map place search tool.

Rules:
- Always use search_place for any question about where to find something
- Extract the place type and location from the user's message
- If no location is mentioned, ask the user for their city first
- After showing the map, briefly describe the place in 1-2 sentences
- Respond in the same language the user uses (Indonesian or English)

Example triggers:
- "Di mana ada warung makan di Mataram?" → search_place(query="warung makan", location="Mataram")
- "Find me a coffee shop near Sudirman" → search_place(query="coffee shop", location="Sudirman Jakarta")
- "Nearest hospital to Senayan" → search_place(query="hospital", location="Senayan Jakarta")
```

---

### 3.4 Ollama Model Setup

Use one of these models (choose based on available RAM):

| Model | RAM needed | Pull command |
|-------|-----------|--------------|
| `llama3.1:8b` | 8GB | `ollama pull llama3.1:8b` |
| `mistral:7b` | 6GB | `ollama pull mistral:7b` |
| `gemma2:9b` | 8GB | `ollama pull gemma2:9b` |

Recommended: **`llama3.1:8b`** - best tool-calling support among the three.

---

### 3.5 Docker Compose (`docker-compose.yml`)

```yaml
version: "3.8"

services:
  ollama:
    image: ollama/ollama
    container_name: ollama
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434"
    restart: unless-stopped

  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    container_name: open-webui
    depends_on:
      - ollama
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
    ports:
      - "3000:8080"
    volumes:
      - open_webui_data:/app/backend/data
    restart: unless-stopped

  backend:
    build: ./backend
    container_name: maps-backend
    env_file:
      - ./backend/.env
    ports:
      - "8000:8000"
    restart: unless-stopped

volumes:
  ollama_data:
  open_webui_data:
```

> Inside Docker, the Open WebUI tool must reach the backend via service name `http://backend:8000`, not `localhost`.

---

## 4. Google Cloud Setup

### Step-by-step:

1. **Create account** at https://console.cloud.google.com (new account = $300 free credit)
2. **Create new project** - name it `llm-maps-project`
3. **Enable APIs** (APIs & Services → Library → search and enable each):
   - Maps Embed API
   - Maps Static API
   - Places API
4. **Create API Key** (APIs & Services → Credentials → Create Credentials → API Key)
5. **Restrict the API key** - CRITICAL:
   - "API restrictions" → Restrict key → select Maps Embed API + Places API only
   - "Application restrictions" → IP addresses → add your machine's IP
   - Save

6. **Set quota limits** (APIs & Services → Quotas & System Limits):
   - Places API Text Search: **100 requests/day**
   - Maps Embed API: **500 requests/day**

### What NOT to do:
- Never put the API key in frontend/client-side code
- Never commit `.env` to Git
- Never leave the key unrestricted (no IP or API restrictions)

---

## 5. Security Requirements

These are mandatory - the reviewer will check for these:

| Requirement | Implementation |
|-------------|---------------|
| API key not in source code | `process.env.GOOGLE_MAPS_API_KEY` only |
| API key not committed to Git | `.env` listed in `.gitignore` |
| Rate limiting on backend | `@fastify/rate-limit`: 10 req/min per IP |
| CORS restricted | Only `http://localhost:3000` allowed |
| Google Cloud key restricted | IP restriction + API-only restriction |
| Daily quota set | Prevents unexpected billing |
| No key logging | Never `console.log` or `fastify.log` the key |
| Input validation | Fastify JSON Schema rejects bad requests before handler runs |

---

## 6. API Contract

### `POST /api/search-place`

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Place type or name, e.g. `"nasi padang"` |
| `location` | string | No | City or area, e.g. `"Jakarta"` |

**Success `200`:**

| Field | Type | Description |
|-------|------|-------------|
| `place_name` | string | Name from Google Places |
| `address` | string | Formatted address |
| `maps_embed_url` | string | URL for `<iframe src="">` |
| `maps_link` | string | Clickable Google Maps URL |
| `lat` | number | Latitude |
| `lng` | number | Longitude |

**Errors:**

| Status | Cause |
|--------|-------|
| `400` | Missing or empty `query` (Fastify schema validation) |
| `404` | No places found in Google Places results |
| `429` | Rate limit exceeded (10 req/min) |
| `500` | Unexpected error (Google API failure, network issue) |

---

## 7. Implementation Order

Execute in this exact order - each step depends on the previous:

```
Step 1: Google Cloud
  └─ Create project
  └─ Enable: Maps Embed API + Places API
  └─ Create API key
  └─ Restrict key: IP address + API scope
  └─ Set daily quotas

Step 2: Backend
  └─ npm init, install dependencies
  └─ Write src/services/gmaps.js
  └─ Test gmaps.js in isolation with a simple node script
  └─ Write src/routes/maps.js
  └─ Write src/server.js
  └─ Test with curl:
       curl -X POST http://localhost:8000/api/search-place \
         -H "Content-Type: application/json" \
         -d '{"query": "nasi padang", "location": "Jakarta"}'

Step 3: Docker
  └─ Write backend/Dockerfile
  └─ Write docker-compose.yml
  └─ docker compose up -d
  └─ docker exec ollama ollama pull llama3.1:8b

Step 4: Open WebUI
  └─ Open http://localhost:3000
  └─ Create admin account
  └─ Add maps_tool.py as a Tool (Settings → Tools → +)
  └─ Set system prompt (Settings → Models → your model → System Prompt)
  └─ Enable tool for the model

Step 5: End-to-end test
  └─ Chat: "Di mana warung makan di Mataram?"
  └─ Verify: LLM calls search_place tool
  └─ Verify: map iframe appears in chat response
  └─ Verify: "Open in Google Maps" link opens correct location

Step 6: Docs
  └─ Fill in docs/ASSUMPTIONS.md
  └─ Write README.md with setup instructions
```

---

## 8. Testing Checklist

Before submission, verify each item:

- [ ] `POST /api/search-place` returns correct JSON for a valid query
- [ ] `POST /api/search-place` returns `400` when `query` is empty or missing
- [ ] `POST /api/search-place` returns `404` when no results found
- [ ] Rate limit triggers a `429` after 10 requests/minute from same IP
- [ ] `.env` is NOT in Git (`git status` should not show it)
- [ ] `.env.example` IS committed with placeholder values only
- [ ] `node_modules/` is NOT in Git
- [ ] `docker compose up -d` starts all 3 services without errors
- [ ] Ollama responds at `http://localhost:11434`
- [ ] Open WebUI loads at `http://localhost:3000`
- [ ] Backend responds at `http://localhost:8000`
- [ ] LLM triggers the map tool when asked about a place
- [ ] Map iframe renders correctly in Open WebUI chat
- [ ] "Open in Google Maps" link opens the correct location
- [ ] Google Cloud API key has IP restriction configured
- [ ] Google Cloud daily quota limits are set

---

## 9. Assumptions to Document

Write these in `docs/ASSUMPTIONS.md`:

1. User runs on a machine with at least 8GB RAM (for LLM model)
2. Docker and Docker Compose v2 are pre-installed
3. Only the top result from Google Places is returned - assumed sufficient for demo purposes
4. The backend runs locally only - no public-facing deployment
5. `location` is optional - if omitted, Google Places searches globally
6. Tool calling works reliably with `llama3.1:8b` - smaller or older models may need prompt adjustment
7. Places API language is set to `en` (English)
8. Node.js native `fetch` is used (requires Node 18+) - no need for `axios`

---

## 10. Key Files Reference

| File | Language | Purpose | Commit? |
|------|----------|---------|---------|
| `backend/.env` | - | Stores API key | NO |
| `backend/.env.example` | - | Key template | YES |
| `backend/src/server.js` | JS | Fastify app entry | YES |
| `backend/src/services/gmaps.js` | JS | Google API calls | YES |
| `backend/src/routes/maps.js` | JS | Route handler | YES |
| `backend/Dockerfile` | - | Container build | YES |
| `openwebui/tools/maps_tool.py` | Python | LLM tool (required by Open WebUI) | YES |
| `openwebui/prompts/system.md` | - | LLM behavior instructions | YES |
| `docker-compose.yml` | - | Service orchestration | YES |
| `docs/ASSUMPTIONS.md` | - | Design decisions | YES |
