from models import Wallet
from fastapi import HTTPException
from sqlalchemy.orm import Session

async def my_wallet(db : Session, owner_id : int, owner_role : str):
    """Get current wallet balance"""
    wallet = db.query(Wallet).filter(Wallet.role == owner_role, Wallet.user_id == owner_id).first()
    if not wallet : 
        raise HTTPException(status_code = 404, detail = "Wallet not found")

    response = {"balance" : float(wallet.balance)}

    return response

async def top_up(db : Session, amount : int, owner_id : int, owner_role : str, owner_type : str):
    """Add money to wallet"""
    wallet = db.query(Wallet).filter(Wallet.role == owner_role, Wallet.user_id   == owner_id).first()

    if wallet:
        wallet.balance += amount
    else:
        raise HTTPException(status_code = 404, detail = "Wallet not found")

    db.commit()
    
    return {
        "id" : owner_id,
        "role" : owner_type,
        "balance" : wallet.balance,
        "message" : "Wallet topped up successfully"
    }