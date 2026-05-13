import requests
from logs.logging import logger

# function to get user pincode from his lat and lon coordinates
async def get_user_pincode(lat, lon):
    url = f"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lon}"
    response = requests.get(url)
    data = response.json()
    logger.info("current requesters pincode: ", data.get("address").get("postcode"))
    return data.get("address").get("postcode")

async def get_lat_lon_from_address(name, address, city, state, zip):
    url = "https://nominatim.openstreetmap.org/search"
    headers = {"User-Agent": "scanbo-app"}

    queries = [
        f"{name}, {zip}, {city}, {state}, India",
        f"{name}, {zip}, {city}, India",
        f"{address}, {zip}, {city}, India",
        f"{name}, {zip}"
    ]
    for q in queries:
        logger.info(f"Trying : {q}")

        res = requests.get(url, params={
            "q": q,
            "format": "json",
            "limit": 1
        }, headers=headers)

        if res.status_code != 200:
            continue

        data = res.json()

        if data:
            lat = float(data[0]["lat"])
            lon = float(data[0]["lon"])
            logger.info(f"Found : {q}")
            return lat, lon 

    logger.info("ALL FAILED for:", name)
    return None, None