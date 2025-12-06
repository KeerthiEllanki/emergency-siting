from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
import json
import pytz
from firebase_auth import get_firebase_user
from firestore_db import get_db
from schemas import SaveLocationIn, SaveLocationOut, LocationOut

router = APIRouter(prefix="/locations", tags=["locations"])

# Use Eastern timezone
eastern = pytz.timezone('America/New_York')

def geometries_match(geom1, geom2, tolerance=0.0001):
    """
    Check if two geometries are the same (within tolerance).
    For Points, compare coordinates directly.
    """
    if geom1.get("type") != geom2.get("type"):
        return False
    
    coords1 = geom1.get("coordinates", [])
    coords2 = geom2.get("coordinates", [])
    
    if geom1["type"] == "Point":
        # Compare [lon, lat]
        if len(coords1) != 2 or len(coords2) != 2:
            return False
        return (abs(coords1[0] - coords2[0]) < tolerance and 
                abs(coords1[1] - coords2[1]) < tolerance)
    
    # For other geometry types, could implement more complex matching
    # For now, do a simple coordinate comparison
    return json.dumps(coords1, sort_keys=True) == json.dumps(coords2, sort_keys=True)

@router.post("", response_model=SaveLocationOut)
def create_location(payload: SaveLocationIn, user = Depends(get_firebase_user)):
    """
    Create or return existing location.
    If a location with the same geometry already exists, return its ID.
    Otherwise, create a new location.
    """
    db = get_db()
    
    # Check if this geometry already exists
    existing_locations = db.collection("locations").stream()
    
    for loc_doc in existing_locations:
        loc_data = loc_doc.to_dict()
        existing_geom = json.loads(loc_data["geometry_json"])
        
        # Extract geometry from the feature if needed
        if existing_geom.get("type") == "Feature":
            existing_geom = existing_geom.get("geometry", existing_geom)
        
        new_geom = payload.geometry_json
        if new_geom.get("type") == "Feature":
            new_geom = new_geom.get("geometry", new_geom)
        
        # If geometries match, return existing location ID
        if geometries_match(existing_geom, new_geom):
            print(f"Location already exists: {loc_doc.id}")
            return {"id": loc_doc.id}
    
    # Create new location if no match found
    doc = {
        "name": payload.name,
        "geometry_json": json.dumps(payload.geometry_json),
        "created_at": datetime.now(eastern).isoformat(),
        "created_by_uid": user["uid"],  # Track who first created it
    }
    _, ref = db.collection("locations").add(doc)
    print(f"Created new location: {ref.id}")
    return {"id": ref.id}

@router.get("", response_model=list[LocationOut])
def list_all_locations(user = Depends(get_firebase_user)):
    """
    List ALL locations with complete data including user information.
    This allows users to see what locations have been saved by anyone,
    and enables proper filtering on the frontend.
    """
    db = get_db()
    q = db.collection("locations")
    out = []
    for d in q.stream():
        data = d.to_dict()
        
        # Return ALL fields from the database
        location_data = {
            "id": d.id, 
            "name": data.get("name", "Unnamed Location"), 
            "geometry_json": data.get("geometry_json", "{}"),
        }
        
        # Add user/timestamp fields if they exist
        if "created_by_uid" in data:
            location_data["created_by_uid"] = data["created_by_uid"]
        if "created_at" in data:
            location_data["created_at"] = data["created_at"]
        if "created_by" in data:  # Handle legacy field names
            location_data["created_by"] = data["created_by"]
            
        out.append(location_data)
        
    print(f"Returning {len(out)} locations with full data")
    print(out)
    return out

@router.delete("/{location_id}")
def delete_location(location_id: str, user = Depends(get_firebase_user)):
    """
    Delete a location.
    Only the user who created it can delete it.
    """
    db = get_db()
    ref = db.collection("locations").document(location_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(404, "Location not found")
    
    # Check if user created this location
    data = snap.to_dict()
    created_by = data.get("created_by_uid") or data.get("created_by")
    
    if created_by and created_by != user["uid"]:
        raise HTTPException(403, "You can only delete locations you created")
    
    ref.delete()
    print(f"Deleted location {location_id} by user {user['uid']}")
    return {"ok": True}