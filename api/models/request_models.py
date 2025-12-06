from pydantic import BaseModel
from typing import List, Literal, Optional

class OptimizeRequest(BaseModel):
    aoi: dict  
    p: int
    radius_m: float
    wheelchair_mode: bool
    candidate_types: List[str]
    top_k: Optional[int] = 20
    age_groups: Optional[List[str]] = []
