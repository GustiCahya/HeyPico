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
        BACKEND_URL: str = "http://backend:8000"
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

[Open in Google Maps]({maps_link}) | [Get Directions]({directions_link})"""

        except Exception as e:
            return f"Map search failed: {str(e)}"