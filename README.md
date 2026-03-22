# Local LLM with Google Maps Integration (Node.js/Fastify)

![Tests](https://img.shields.io/badge/tests-35%20passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-4%20suites-brightgreen)
![Node](https://img.shields.io/badge/node-20%20LTS-green)
![Fastify](https://img.shields.io/badge/fastify-v4-black)
![Docker](https://img.shields.io/badge/docker-ready-blue)
![Security](https://img.shields.io/badge/security-rate%20limited-orange)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

This project integrates a local LLM (via Ollama and Open WebUI) with Google Maps API via a local Fastify backend. Users can chat with the LLM and ask about places to eat, visit, or find — and receive an embedded Google Map directly in the chat.

---

## Test Coverage

All critical backend functionality is covered by unit tests across 4 test suites.

Run tests with: `npm test`

### Suite 1 — Google Maps Service (`src/services/gmaps.js`)

| # | Test Case | What It Verifies | Status |
|---|-----------|-----------------|--------|
| 1 | Valid query returns structured place data | `place_name`, `address`, `lat`, `lng` all present | ✅ Pass |
| 2 | `maps_embed_url` contains `place_id` and API key | Embed URL is correctly formed | ✅ Pass |
| 3 | `maps_link` is a valid Google Maps search URL | Directions link opens correct location | ✅ Pass |
| 4 | Query and location are combined in fetch call | Search context is passed correctly to Places API | ✅ Pass |
| 5 | Works with no location (query only) | Location field is optional | ✅ Pass |
| 6 | Passes `language=id` to Places API | Indonesian results returned by default | ✅ Pass |
| 7 | `lat` and `lng` returned as numbers, not strings | Correct data types in response | ✅ Pass |
| 8 | Returns `null` when status is `ZERO_RESULTS` | Graceful handling of no results | ✅ Pass |
| 9 | Returns `null` when results array is empty | Edge case: OK status but empty results | ✅ Pass |
| 10 | Returns `null` on `REQUEST_DENIED` | Invalid/restricted key handled | ✅ Pass |
| 11 | Returns `null` on `INVALID_REQUEST` | Malformed query handled | ✅ Pass |
| 12 | API key is read from environment, not hardcoded | Key not baked into source code | ✅ Pass |
| 13 | API key does NOT appear in the returned result | Key not exposed to LLM or user | ✅ Pass |
| 14 | Embed URL contains the key (required by Maps Embed API) | iframe src is valid | ✅ Pass |
| 15 | Rejects when fetch fails (network down) | Network error handled gracefully | ✅ Pass |
| 16 | Handles fetch timeout | Timeout error handled gracefully | ✅ Pass |

### Suite 2 — Fastify Route (`src/routes/maps.js`)

| # | Test Case | What It Verifies | Status |
|---|-----------|-----------------|--------|
| 17 | Returns `200` with place data on valid request | Core endpoint works end-to-end | ✅ Pass |
| 18 | Response includes all required fields | Contract: all 6 fields present | ✅ Pass |
| 19 | Works without `location` field | Optional field handled | ✅ Pass |
| 20 | Returns `400` when `query` is missing | Validation rejects bad input | ✅ Pass |
| 21 | Returns `400` when `query` is empty string | Validation rejects empty string | ✅ Pass |
| 22 | Returns `400` when body is empty | Validation rejects empty body | ✅ Pass |
| 23 | Returns `404` when no places found | Not-found case returns correct status | ✅ Pass |
| 24 | `404` body contains `error` message | Error message is human-readable | ✅ Pass |
| 25 | Response `Content-Type` is `application/json` | Correct headers returned | ✅ Pass |

### Suite 3 — Security & Best Practices

| # | Test Case | What It Verifies | Status |
|---|-----------|-----------------|--------|
| 26 | `GOOGLE_MAPS_API_KEY` loaded from environment | Key management best practice | ✅ Pass |
| 27 | API key is not the placeholder value | Real key configured, not template | ✅ Pass |
| 28 | `ALLOWED_ORIGINS` is set and not wildcard `*` | CORS not open to all origins | ✅ Pass |
| 29 | `maps_embed_url` uses HTTPS | Secure transport enforced | ✅ Pass |
| 30 | `maps_link` uses HTTPS | Secure transport enforced | ✅ Pass |

### Suite 4 — Map Output Correctness

| # | Test Case | What It Verifies | Status |
|---|-----------|-----------------|--------|
| 31 | `maps_embed_url` is a valid URL | `new URL()` does not throw | ✅ Pass |
| 32 | `maps_link` is a valid URL | `new URL()` does not throw | ✅ Pass |
| 33 | `maps_embed_url` uses Maps Embed API endpoint | Correct Google API used | ✅ Pass |
| 34 | `place_name` is a non-empty string | LLM receives readable place name | ✅ Pass |
| 35 | `lat` and `lng` are within valid geographic range | Coordinates are geographically valid | ✅ Pass |

---

## Production Readiness Checklist

| Category | Item | Status |
|----------|------|--------|
| **Security** | API key stored in `.env`, never in source code | ✅ |
| **Security** | `.env` excluded from Git via `.gitignore` | ✅ |
| **Security** | Google Cloud API key restricted to specific APIs only | ✅ |
| **Security** | Google Cloud API key restricted to server IP address | ✅ |
| **Security** | CORS restricted to `http://localhost:3000` only | ✅ |
| **Security** | Input validated via Fastify JSON Schema before handler runs | ✅ |
| **Security** | API key never logged or returned in any response | ✅ |
| **Reliability** | Rate limiting: 10 requests/minute per IP (`@fastify/rate-limit`) | ✅ |
| **Reliability** | Daily quota limits set on Google Cloud Console | ✅ |
| **Reliability** | Graceful `404` when no places found | ✅ |
| **Reliability** | Graceful error handling on network/fetch failure | ✅ |
| **Reliability** | All services restart automatically via Docker (`restart: unless-stopped`) | ✅ |
| **Testing** | 35 unit tests across 4 suites | ✅ |
| **Testing** | Service layer, route layer, security, and output all covered | ✅ |
| **Testing** | External API (Google Places) mocked — tests run offline | ✅ |
| **Maintainability** | Separation of concerns: service / route / plugin layers | ✅ |
| **Maintainability** | `.env.example` committed as configuration template | ✅ |
| **Maintainability** | `npm ci` used in Dockerfile for reproducible builds | ✅ |
| **Maintainability** | `node_modules/` excluded from Git | ✅ |
| **Portability** | Full Docker Compose setup (Ollama + Open WebUI + backend) | ✅ |
| **Portability** | Native `fetch` used — no unnecessary dependencies | ✅ |

---

## Setup Instructions

### 1. Google Cloud Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com) and create a project.
2. Enable **Maps Embed API** and **Places API**.
3. Create an API Key and restrict it to the enabled APIs and your local IP address.
4. Go to Quotas: set Places API Text Search daily limit to 100 requests/day, and Maps Embed API to 500 requests/day.

### 2. Backend Config
1. Rename `backend/.env.example` to `backend/.env`.
2. Edit `backend/.env` to include your `GOOGLE_MAPS_API_KEY`.

### 3. Run with Docker Compose
1. Ensure Docker Desktop is running.
2. Run:
   ```sh
   docker compose up -d
   ```
3. Pull the LLM model (first time only, ~5GB):
   ```sh
   docker exec -it ollama ollama pull llama3.1:8b
   ```

### 4. Open WebUI Configuration
1. Open [http://localhost:3000](http://localhost:3000) and register an admin account.
2. Go to **Settings → Tools**: add a new tool using the contents of `openwebui/tools/maps_tool.py`.
3. Go to **Settings → Models → Edit Model → System Prompt**: paste the contents of `openwebui/prompts/system.md`.
4. Chat with the LLM and ask about a location!

---

## Running Tests

```sh
cd backend
npm install
npm test
```

Expected output:
```
 PASS  backend.test.js
  searchPlace() — Google Maps service
    ✓ returns structured place data for a valid query
    ✓ maps_embed_url contains place_id and API key
    ... (35 tests total)

Test Suites: 1 passed, 1 total
Tests:       35 passed, 35 total
```

---

## Common Commands

| Action | Command |
|--------|---------|
| Start all services | `docker compose up -d` |
| Stop all services | `docker compose down` |
| View backend logs | `docker logs maps-backend -f` |
| Restart backend | `docker compose restart backend` |
| Check service status | `docker compose ps` |
| Run unit tests | `cd backend && npm test` |