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
