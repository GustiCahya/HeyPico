# Assumptions

1. User runs on a machine with at least 8GB RAM (for LLM model)
2. Docker and Docker Compose v2 are pre-installed
3. Only the top result from Google Places is returned - assumed sufficient for demo purposes
4. The backend runs locally only - no public-facing deployment
5. `location` is optional - if omitted, Google Places searches globally
6. Tool calling works reliably with `llama3.1:8b` - smaller or older models may need prompt adjustment
7. Places API language is set to `id` (Indonesian) - update to `en` for English results
8. Node.js native `fetch` is used (requires Node 18+) - no need for `axios`
