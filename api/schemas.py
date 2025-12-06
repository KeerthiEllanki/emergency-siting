from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class SaveLocationIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    geometry_json: Dict[str, Any]  

class SaveLocationOut(BaseModel):
    id: str

class LocationOut(BaseModel):
    id: str
    name: str
    geometry_json: str
    created_by_uid: Optional[str] = None  
    created_at: Optional[str] = None      
    created_by: Optional[str] = None 
    

class BookingIn(BaseModel):
    location_id: str  
    start_time: datetime  
    end_time: datetime

class BookingOut(BaseModel):
    id: str
    location_id: str 
    location_name: Optional[str] = None
    uid: str
    user_email: str
    start_time: datetime
    end_time: datetime