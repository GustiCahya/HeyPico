# Local LLM with Google Maps Integration (Node.js/Fastify)

This project integrates a local LLM (via Ollama and Open WebUI) with Google Maps API via a local Fastify backend.

## Setup Instructions

### 1. Google Cloud Setup
1. Go to Google Cloud Console and create a project.
2. Enable **Maps Embed API** and **Places API**.
3. Create an API Key and restrict it to the enabled APIs and your local IP address.
4. Go to Quotas: set Places API Text Search daily limit to 100 requests/day, and Maps Embed API to 500 requests/day.

### 2. Backend Config
1. Rename `backend/.env.example` to `backend/.env`.
2. Edit `backend/.env` to include your `GOOGLE_MAPS_API_KEY`.

### 3. Run with Docker Compose
1. Ensure Docker is running.
2. Run `docker compose up -d`.
3. Start pulling the LLM model:
   ```sh
   docker exec -it ollama ollama pull llama3.1:8b
   ```

### 4. Open WebUI Configuration
1. Open [http://localhost:3000](http://localhost:3000) and register an admin account.
2. Go to **Settings -> Tools**: add a new tool using the contents of `openwebui/tools/maps_tool.py`.
3. Go to **Settings -> Models -> Edit Model -> System Prompt**: add the instructions from `openwebui/prompts/system.md`.
4. Chat with the LLM and ask about a location!

