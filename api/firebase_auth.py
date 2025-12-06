import os
import firebase_admin
from firebase_admin import credentials, auth
from fastapi import Header, HTTPException

# Use absolute path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SA_PATH = os.path.join(BASE_DIR, "firebase-service-account.json")

print(f"Looking for Firebase credentials at: {SA_PATH}")

if not firebase_admin._apps:
    if not os.path.exists(SA_PATH):
        raise FileNotFoundError(f"Firebase file not found at: {SA_PATH}")
    cred = credentials.Certificate(SA_PATH)
    firebase_admin.initialize_app(cred)
    print("Firebase initialized successfully!")

def get_firebase_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        return auth.verify_id_token(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")