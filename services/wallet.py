from models import Wallet
from fastapi import HTTPException
from sqlalchemy.orm import Session

from services.payment import handle_payment

async def my_wallet(db : Session, owner_id : int, owner_role : str):
    """Get current wallet balance"""
    wallet = db.query(Wallet).filter(Wallet.role == owner_role, Wallet.user_id == owner_id).first()
    if not wallet : 
        raise HTTPException(status_code = 404, detail = "Wallet not found")

    response = {"balance" : float(wallet.balance)}

    return response

async def top_up(db: Session, amount: int, owner_id: int, owner_role : str, owner_type : str):
    wallet = db.query(Wallet).filter(Wallet.role == owner_role, Wallet.user_id == owner_id).first()
    if not wallet:
        raise HTTPException(status_code = 404, detail = "Wallet not found")

    # First, process the payment
    result = await handle_payment(
        db, 
        owner_id, 
        owner_role, 
        owner_id, 
        owner_role, 
        amount, 
        note = "Topping up wallet", 
        type = "TOP-UP"
    )
    if not result:
        raise HTTPException(status_code = 400, detail = "Payment failed")

    # Then update wallet balance
    wallet.balance += amount
    db.commit()
    db.refresh(wallet)

    return {
        "id": owner_id,
        "role": owner_type,
        "balance": wallet.balance,
        "payment_added": result,
        "message": "Wallet topped up successfully"
    }