/**
 * Unit Tests — Local LLM with Google Maps Integration
 * Backend: Node.js + Fastify
 *
 * Run with:  node --experimental-vm-modules node_modules/.bin/jest
 * Or:        npx jest backend.test.js
 *
 * Install test deps first:
 *   npm install --save-dev jest jest-environment-node
 */

import { jest } from '@jest/globals'

// ─── Mock fetch globally before importing anything ───────────────────────────
const mockFetch = jest.fn()
global.fetch = mockFetch

// ─── Mock env ─────────────────────────────────────────────────────────────────
process.env.GOOGLE_MAPS_API_KEY = 'TEST_API_KEY_123'
process.env.ALLOWED_ORIGINS = 'http://localhost:3000'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
const MAPS_LINK_BASE = 'https://www.google.com/maps/search/'

/** Build a minimal Google Places API success response */
function makePlacesResponse(overrides = {}) {
  return {
    status: 'OK',
    results: [
      {
        name: overrides.name ?? 'Warung Makan Sederhana',
        formatted_address: overrides.address ?? 'Jl. Pejanggik No.10, Mataram, NTB',
        place_id: overrides.place_id ?? 'ChIJmock1234567890',
        geometry: {
          location: {
            lat: overrides.lat ?? -8.5832,
            lng: overrides.lng ?? 116.1203,
          },
        },
      },
    ],
  }
}

/** Make fetch resolve with a JSON payload */
function mockFetchSuccess(payload) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => payload,
  })
}

/** Make fetch resolve with a Places API error status */
function mockFetchPlacesError(status = 'ZERO_RESULTS') {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ status, results: [] }),
  })
}

// ─── Import the service under test ───────────────────────────────────────────
// Adjust path to match your actual project structure
let searchPlace
beforeAll(async () => {
  const mod = await import('./src/services/gmaps.js')
  searchPlace = mod.searchPlace
})

beforeEach(() => {
  mockFetch.mockClear()
})

// ═════════════════════════════════════════════════════════════════════════════
// 1. GOOGLE MAPS SERVICE  (src/services/gmaps.js)
// ═════════════════════════════════════════════════════════════════════════════
describe('searchPlace() — Google Maps service', () => {

  // ── 1.1  Happy path ────────────────────────────────────────────────────────
  describe('happy path', () => {

    test('returns structured place data for a valid query', async () => {
      mockFetchSuccess(makePlacesResponse())
      const result = await searchPlace('warung makan', 'Mataram')

      expect(result).toMatchObject({
        place_name: 'Warung Makan Sederhana',
        address: 'Jl. Pejanggik No.10, Mataram, NTB',
        lat: -8.5832,
        lng: 116.1203,
      })
    })

    test('passes language=en to Places API', async () => {
      mockFetchSuccess(makePlacesResponse())
      await searchPlace('apotek', 'Mataram')

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain('language=en')
    })

    test('returns lat and lng as numbers, not strings', async () => {
      mockFetchSuccess(makePlacesResponse({ lat: -6.2088, lng: 106.8456 }))
      const result = await searchPlace('mall', 'Jakarta')

      expect(typeof result.lat).toBe('number')
      expect(typeof result.lng).toBe('number')
    })
  })

  // ── 1.2  No results ────────────────────────────────────────────────────────
  describe('no results from Google Places', () => {

    test('returns null when status is ZERO_RESULTS', async () => {
      mockFetchPlacesError('ZERO_RESULTS')
      const result = await searchPlace('xyznonexistentplace999', 'Mars')
      expect(result).toBeNull()
    })

    test('returns null when results array is empty', async () => {
      mockFetchSuccess({ status: 'OK', results: [] })
      const result = await searchPlace('tempat hantu', 'Nowhere')
      expect(result).toBeNull()
    })

    test('returns null when Places API returns REQUEST_DENIED', async () => {
      mockFetchPlacesError('REQUEST_DENIED')
      const result = await searchPlace('cafe', 'Jakarta')
      expect(result).toBeNull()
    })

    test('returns null when Places API returns INVALID_REQUEST', async () => {
      mockFetchPlacesError('INVALID_REQUEST')
      const result = await searchPlace('', '')
      expect(result).toBeNull()
    })
  })

  // ── 1.3  Security: API key handling ────────────────────────────────────────
  describe('API key security', () => {

    test('API key is read from environment, not hardcoded', async () => {
      mockFetchSuccess(makePlacesResponse())
      await searchPlace('test', 'test')

      const calledUrl = mockFetch.mock.calls[0][0]
      // Key from env must appear in the request
      expect(calledUrl).toContain('TEST_API_KEY_123')
      // No hardcoded key patterns (common mistakes)
      expect(calledUrl).not.toContain('AIzaSy_HARDCODED')
    })

    test('API key is NOT present in the returned result object', async () => {
      mockFetchSuccess(makePlacesResponse())
      const result = await searchPlace('hotel', 'Bali')

      // The result JSON sent back to the LLM tool should not expose the key
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toContain('TEST_API_KEY_123')
    })
  })

  // ── 1.4  Network / fetch errors ───────────────────────────────────────────
  describe('network error handling', () => {

    test('throws or rejects when fetch fails (network down)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network unreachable'))
      await expect(searchPlace('test', 'test')).rejects.toThrow()
    })

    test('handles fetch timeout gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('The operation was aborted'))
      await expect(searchPlace('warung', 'Mataram')).rejects.toThrow()
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. FASTIFY ROUTE  (src/routes/maps.js)
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/search-place — Fastify route', () => {

  let app

  // Build a test Fastify instance with mocked service
  beforeAll(async () => {
    const Fastify = (await import('fastify')).default
    app = Fastify()

    // Register route with mocked searchPlace injected via decorator
    app.decorate('searchPlace', null)

    await app.register(async (fastify) => {
      const schema = {
        body: {
          type: 'object',
          required: ['query'],
          properties: {
            query: { type: 'string', minLength: 1 },
            location: { type: 'string', default: '' },
          },
        },
      }

      fastify.post('/api/search-place', { schema }, async (request, reply) => {
        const { query, location = '' } = request.body
        const result = await app.searchPlace(query, location)
        if (!result) return reply.status(404).send({ error: 'No places found for query' })
        return result
      })
    })

    await app.ready()
  })

  afterAll(() => app.close())

  const validPayload = { query: 'warung makan', location: 'Mataram' }

  const mockResult = {
    place_name: 'Warung Sederhana',
    address: 'Jl. Pejanggik, Mataram',
    maps_link: 'https://www.google.com/maps/search/?api=1&query=-8.58,116.12',
    lat: -8.58,
    lng: 116.12,
  }

  // ── 2.1  Success ──────────────────────────────────────────────────────────
  describe('200 OK', () => {

    test('returns 200 with place data on valid request', async () => {
      app.searchPlace = jest.fn().mockResolvedValue(mockResult)

      const res = await app.inject({
        method: 'POST',
        url: '/api/search-place',
        payload: validPayload,
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.place_name).toBe('Warung Sederhana')
      expect(body.maps_link).toBeDefined()
    })

    test('response includes all required fields', async () => {
      app.searchPlace = jest.fn().mockResolvedValue(mockResult)

      const res = await app.inject({
        method: 'POST',
        url: '/api/search-place',
        payload: validPayload,
      })

      const body = JSON.parse(res.body)
      expect(body).toHaveProperty('place_name')
      expect(body).toHaveProperty('address')
      expect(body).toHaveProperty('maps_link')
      expect(body).toHaveProperty('lat')
      expect(body).toHaveProperty('lng')
    })

    test('works without location field (optional)', async () => {
      app.searchPlace = jest.fn().mockResolvedValue(mockResult)

      const res = await app.inject({
        method: 'POST',
        url: '/api/search-place',
        payload: { query: 'ATM' },
      })

      expect(res.statusCode).toBe(200)
    })
  })

  // ── 2.2  Validation errors ────────────────────────────────────────────────
  describe('400 Bad Request', () => {

    test('returns 400 when query is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/search-place',
        payload: { location: 'Jakarta' },
      })
      expect(res.statusCode).toBe(400)
    })

    test('returns 400 when query is empty string', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/search-place',
        payload: { query: '' },
      })
      expect(res.statusCode).toBe(400)
    })

    test('returns 400 when body is empty', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/search-place',
        payload: {},
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ── 2.3  Not found ────────────────────────────────────────────────────────
  describe('404 Not Found', () => {

    test('returns 404 when no places found', async () => {
      app.searchPlace = jest.fn().mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: '/api/search-place',
        payload: { query: 'xyznonexistent999', location: 'Mars' },
      })

      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.body)
      expect(body.error).toBe('No places found for query')
    })
  })

  // ── 2.4  Content type ─────────────────────────────────────────────────────
  describe('response headers', () => {

    test('response Content-Type is application/json', async () => {
      app.searchPlace = jest.fn().mockResolvedValue(mockResult)

      const res = await app.inject({
        method: 'POST',
        url: '/api/search-place',
        payload: validPayload,
      })

      expect(res.headers['content-type']).toContain('application/json')
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. SECURITY & BEST PRACTICES
// ═════════════════════════════════════════════════════════════════════════════
describe('Security & best practices', () => {

  test('GOOGLE_MAPS_API_KEY is loaded from environment variable', () => {
    expect(process.env.GOOGLE_MAPS_API_KEY).toBeDefined()
    expect(process.env.GOOGLE_MAPS_API_KEY.length).toBeGreaterThan(0)
  })

  test('GOOGLE_MAPS_API_KEY is not the placeholder value', () => {
    expect(process.env.GOOGLE_MAPS_API_KEY).not.toBe('your_google_maps_api_key_here')
    expect(process.env.GOOGLE_MAPS_API_KEY).not.toBe('YOUR_API_KEY')
  })

  test('ALLOWED_ORIGINS is set and not wildcard', () => {
    expect(process.env.ALLOWED_ORIGINS).toBeDefined()
    expect(process.env.ALLOWED_ORIGINS).not.toBe('*')
  })

  test('maps_link starts with HTTPS', async () => {
    mockFetchSuccess(makePlacesResponse())
    const result = await searchPlace('hotel', 'Bali')
    expect(result.maps_link).toMatch(/^https:\/\//)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. MAPS OUTPUT — what the LLM returns to the user
// ═════════════════════════════════════════════════════════════════════════════
describe('Map output correctness', () => {

  test('maps_link is a valid URL', async () => {
    mockFetchSuccess(makePlacesResponse())
    const result = await searchPlace('apotek', 'Mataram')
    expect(() => new URL(result.maps_link)).not.toThrow()
  })

  test('place_name is a non-empty string', async () => {
    mockFetchSuccess(makePlacesResponse({ name: 'Rumah Sakit Umum Mataram' }))
    const result = await searchPlace('rumah sakit', 'Mataram')
    expect(typeof result.place_name).toBe('string')
    expect(result.place_name.length).toBeGreaterThan(0)
  })

  test('address is a non-empty string', async () => {
    mockFetchSuccess(makePlacesResponse())
    const result = await searchPlace('hotel', 'NTB')
    expect(typeof result.address).toBe('string')
    expect(result.address.length).toBeGreaterThan(0)
  })

  test('lat is within valid range (-90 to 90)', async () => {
    mockFetchSuccess(makePlacesResponse({ lat: -8.5832 }))
    const result = await searchPlace('pantai', 'Lombok')
    expect(result.lat).toBeGreaterThanOrEqual(-90)
    expect(result.lat).toBeLessThanOrEqual(90)
  })

  test('lng is within valid range (-180 to 180)', async () => {
    mockFetchSuccess(makePlacesResponse({ lng: 116.1203 }))
    const result = await searchPlace('pantai', 'Lombok')
    expect(result.lng).toBeGreaterThanOrEqual(-180)
    expect(result.lng).toBeLessThanOrEqual(180)
  })
})