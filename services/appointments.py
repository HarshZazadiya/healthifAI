from models import Doctors, Hospitals, Appointments, Symptoms

async def get_appointments_for_user(db, requester_id, role, status = None):
    if role == "user":
        appointments = db.query(Appointments).filter(Appointments.user_id == requester_id).all()
    elif role == "doctor":
        appointments = db.query(Appointments).filter(Appointments.doctor_id == requester_id).all()
    elif role == "hospital":
        hospital = db.query(Hospitals).filter(Hospitals.id == requester_id).first()
        if not hospital:
            raise ValueError("Hospital not found")
        doctors = db.query(Doctors).filter(Doctors.hospital_id == hospital.id).all()
        doctor_ids = [doctor.id for doctor in doctors]
        appointments = db.query(Appointments).filter(Appointments.doctor_id.in_(doctor_ids)).all()
    elif role == "admin":
        appointments = db.query(Appointments).all()
    else:
        raise ValueError("Invalid role")
    
    if status:
        appointments = [appointment for appointment in appointments if appointment.status == status]

    return appointments

async def book_appointment(db, user_id, doctor_id, symptom_ids, priority):
    new_appointment = Appointments(
        user_id = user_id,
        doctor_id = doctor_id,
        status = "pending",
        priority = priority
    )
    db.add(new_appointment)
    db.commit()
    db.refresh(new_appointment)

    for symptom_id in symptom_ids:
        new_symptom = Symptoms(
            appointment_id = new_appointment.id,
            user_id = user_id,
            symptom_id = symptom_id
        )
        db.add(new_symptom)

    db.commit()
    return new_appointment

async def cancel_appointment(db, appointment_id, user_id, role):
    appointment = db.query(Appointments).filter(Appointments.id == appointment_id).first()
    if not appointment:
        raise ValueError("Appointment not found")

    if role == "user" and appointment.user_id != user_id:
        raise ValueError("User can only cancel their own appointments")
    elif role == "host" and appointment.doctor_id != user_id:
        raise ValueError("Doctor can only cancel their own appointments")
    elif role == "hospital":
        hospital = db.query(Hospitals).filter(Hospitals.id == user_id).first()
        if not hospital:
            raise ValueError("Hospital not found")
        doctor = db.query(Doctors).filter(Doctors.id == appointment.doctor_id, Doctors.hospital_id == hospital.id).first()
        if not doctor:
            raise ValueError("Doctor not found in this hospital")

    appointment.status = "cancelled"
    db.commit()
    return appointment

async def complete_appointment(db, appointment_id, user_id, role):
    appointment = db.query(Appointments).filter(Appointments.id == appointment_id).first()
    if not appointment:
        raise ValueError("Appointment not found")

    if role == "user" and appointment.user_id != user_id:
        raise ValueError("User can only complete their own appointments")
    elif role == "host" and appointment.doctor_id != user_id:
        raise ValueError("Doctor can only complete their own appointments")
    elif role == "hospital":
        hospital = db.query(Hospitals).filter(Hospitals.id == user_id).first()
        if not hospital:
            raise ValueError("Hospital not found")
        doctor = db.query(Doctors).filter(Doctors.id == appointment.doctor_id, Doctors.hospital_id == hospital.id).first()
        if not doctor:
            raise ValueError("Doctor not found in this hospital")

    appointment.status = "completed"
    db.commit()
    return appointment