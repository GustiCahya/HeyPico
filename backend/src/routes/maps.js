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
