import math
from fastapi import HTTPException
from models import Doctors, Hospitals
from utils.hospital_location_getter import hospital_location_getter
from models import Users
from sqlalchemy.orm import Session

async def calculate_distance(lat1 : float, lon1 : float, lat2 : float, lon2 : float) -> float:
    """Calculate distance between two points in kilometers using Haversine formula"""
    R = 6371
    
    lat1_rad = math.radians(float(lat1))
    lat2_rad = math.radians(float(lat2))
    delta_lat = math.radians(float(lat2) - float(lat1))
    delta_lon = math.radians(float(lon2) - float(lon1))
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

async def find_n_nearby_doctors(user : Users, db : Session, n = 10, distance_limit : float = 30.0):
    if user.role != "user":
        raise HTTPException(status_code = 403, detail = "Only users allowed")

    if user.lat is None or user.lon is None:
        raise HTTPException(status_code = 400, detail = "User location not set")

    hospitals = db.query(Hospitals).all()

    results = []
    for hospital in hospitals:
        if hospital.lat is None or hospital.lon is None:
            # this function will set the hospital location, its already set up when hospital was created but just in case
            await hospital_location_getter(hospital.id)
           
        distance = await calculate_distance(
            float(user.lat),
            float(user.lon),
            float(hospital.lat),
            float(hospital.lon)
        )

        if distance > distance_limit:   # distance in km
            continue

        doctors = db.query(Doctors).filter(Doctors.hospital_id == hospital.id).all()
        if not doctors:
            raise HTTPException(status_code = 404, detail = f"⚠️ No doctors in hospital : {hospital.name}")
        for doc in doctors:
            results.append({
                "id" : doc.id,
                "name" : doc.name,
                "email" : doc.email,
                "specialty" : doc.specialty,
                "hospital_name" : hospital.name,
                "hospital_address" : hospital.address,
                "hospital_lat" : hospital.lat,
                "hospital_lon" : hospital.lon,
                "distance_km" : distance
            })

    db.commit()
    results.sort(key = lambda x : x["distance_km"])

    return results[:n]