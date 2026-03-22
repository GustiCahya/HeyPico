"""
title: Google Maps Place Search
author: your_name
description: Search for places and return an embeddable Google Maps iframe
version: 0.1.0
"""

import requests
from pydantic import BaseModel

class Tools:
    class Valves(BaseModel):
        BACKEND_URL: str = "http://backend:8000"  # Docker service name

    def __init__(self):
        self.valves = self.Valves()

    def search_place(self, query: str, location: str = "") -> str:
        """
        Search for a place and return a Google Maps embed.
        Use this when the user asks about places to go, eat, visit, or find.
        :param query: The place type or name to search for
        :param location: Optional city or area to narrow the search
        :return: Markdown string with embedded map and directions link
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

            return f"""
**{data['place_name']}**
{data['address']}

<iframe
  width="100%"
  height="300"
  style="border:0; border-radius:8px;"
  loading="lazy"
  allowfullscreen
  src="{data['maps_embed_url']}">
</iframe>

[Open in Google Maps]({data['maps_link']})
""".strip()

        except Exception as e:
            return f"Map search failed: {str(e)}"
