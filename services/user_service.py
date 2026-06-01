from typing import Optional
from database import SessionLocal
from sqlalchemy import and_, func
from models import Cases, Doctors, Users

async def get_all_users_for_hospital(
    hospital_id : int,
    page : int,
    limit : int,
    status : Optional[str] = None,
    user_name : Optional[str] = None,
    doctor_name : Optional[str] = None,
):
    db = SessionLocal()
    try :
        # Subquery: most recent case per user in this hospital
        latest_case_subq = (
            db.query(Cases.user_id,func.max(Cases.date).label("latest_date")).filter(Cases.hospital_id == hospital_id).group_by(Cases.user_id).subquery()
        )

        # Main query: join users with their latest case
        query = (
            db.query(Users, Cases, Doctors)
            .join(latest_case_subq, Users.id == latest_case_subq.c.user_id)
            .join(Cases, and_(
                Cases.user_id == latest_case_subq.c.user_id,
                Cases.date == latest_case_subq.c.latest_date
            ))
            .outerjoin(Doctors, Cases.doctor_id == Doctors.id)
            .filter(Cases.hospital_id == hospital_id)
        )

        # Apply filters
        if status:
            query = query.filter(Cases.status == status)
        if user_name:
            query = query.filter(Users.name == user_name.title())
        if doctor_name:
            query = query.filter(Doctors.name == doctor_name.title())

        total = query.count()
        results = query.order_by(Cases.date.desc()).offset((page-1)*limit).limit(limit).all()

        data = []
        for user, case, doctor in results:
            data.append({
                "user_id": user.id,
                "user_name": user.name,
                "user_email": user.email,
                "lat": user.lat,
                "lon": user.lon,
                "user_role": user.role,
                "doctor_id": doctor.id if doctor else None,
                "doctor_name": doctor.name if doctor else "Not assigned",
                "doctor_email": doctor.email if doctor else None,
                "doctor_speciality": doctor.speciality if doctor else None,
                "case" : case.id,
                "case_id": case.case_id,
                "case_disease": case.diesease,
                "case_status": case.status,
                "case_date": case.date.isoformat() if case.date else None,
            })

        return {
            "total": total,
            "page": page,
            "limit": limit,
            "data": data
        }
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()

