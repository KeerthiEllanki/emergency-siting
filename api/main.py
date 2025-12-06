from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models.request_models import OptimizeRequest
from services.optimize import run_mclp_model
from routes_locations import router as locations_router
from routes_bookings import router as bookings_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(locations_router)
app.include_router(bookings_router) 

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/optimize/mclp")
def optimize(req: OptimizeRequest):
    """
    Endpoint to run MCLP optimization given user input from frontend.
    """
    return run_mclp_model(req)