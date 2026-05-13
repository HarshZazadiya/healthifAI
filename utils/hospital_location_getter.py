from models import Hospitals
from logs.logging import logger
from fastapi import HTTPException
from utils.dependencies import db_dependency
from utils.get_user_pincode import get_lat_lon_from_address

async def hospital_location_getter(db : db_dependency, hospital_id : int):
    logger.info("Updating hospital location...")
    hospital = db.query(Hospitals).filter(Hospitals.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code = 404, detail = "Hospital not found")
    lat, lon = await get_lat_lon_from_address(
        hospital.name, 
        hospital.address, 
        hospital.city, 
        hospital.state, 
        hospital.zip
    )
    if lat is None or lon is None:
        raise HTTPException(status_code = 404, detail = "Hospital location not found")
    hospital.lat = lat
    hospital.lon = lon
    logger.info(f"Updating hospital location...with {lat}, {lon}, updated to {hospital.lat}, {hospital.lon}")
    db.commit()
    logger.info("Hospital location updated")