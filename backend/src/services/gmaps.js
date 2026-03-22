// This is the ONLY file that touches the Google Maps API key.
// Key is read from environment - never hardcoded, never logged.

const PLACES_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json'

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

  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${placeId}`

  return {
    place_name: place.name,
    address: place.formatted_address,
    maps_link: mapsLink,
    lat,
    lng
  }
}
