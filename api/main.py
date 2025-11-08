from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models.request_models import OptimizeRequest
from services.optimize import run_mclp_model

app = FastAPI()

# Adjust origins if needed
origins = [
    "http://localhost:5173",  # Frontend dev server (Vite)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # OR ["*"] for all origins during dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/optimize/mclp")
def optimize(req: OptimizeRequest):
    """
    Endpoint to run MCLP optimization given user input from frontend.
    """
    return run_mclp_model(req)
