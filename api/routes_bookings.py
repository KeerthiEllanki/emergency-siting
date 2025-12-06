from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from firebase_auth import get_firebase_user
from firestore_db import get_db
from schemas import BookingIn, BookingOut
import pytz

router = APIRouter(prefix="/bookings", tags=["bookings"])

eastern = pytz.timezone('America/New_York')

@router.post("", response_model=BookingOut)
def create_booking(payload: BookingIn, user = Depends(get_firebase_user)):
    db = get_db()

    if payload.start_time >= payload.end_time:
        raise HTTPException(400, "Invalid time range")

    # Ensure location exists and get location name
    loc = db.collection("locations").document(payload.location_id).get()
    if not loc.exists:
        raise HTTPException(404, "Location not found")
    
    location_data = loc.to_dict()
    location_name = location_data.get("name", "Unknown Location")

    new_start = payload.start_time.astimezone(eastern)
    new_end   = payload.end_time.astimezone(eastern)

    # Check for conflicts across ALL users (not just current user)
    # This ensures true conflict prevention for shared locations
    pre_q = db.collection("bookings").where("location_id", "==", payload.location_id)

    conflicts = []
    for doc in pre_q.stream():
        b = doc.to_dict()
        existing_start = datetime.fromisoformat(b["start_time"])
        existing_end = datetime.fromisoformat(b["end_time"])
        
        # Check for overlap: existing.start < new_end AND existing.end > new_start
        if existing_start < new_end and existing_end > new_start:
            conflicts.append({
                "booking_id": doc.id,
                "user": b.get("uid", "unknown"),
                "start": b["start_time"],
                "end": b["end_time"]
            })

    if conflicts:
        # Provide detailed conflict information
        conflict_details = ", ".join([
            f"{c['start']} to {c['end']}" for c in conflicts
        ])
        raise HTTPException(
            409, 
            f"Time slot conflicts with existing booking(s): {conflict_details}"
        )

    now = datetime.now(eastern).isoformat()
    doc = {
        "location_id": payload.location_id,
        "uid": user["uid"],
        "user_email": user.get("email", "unknown"),  # Store email for reference
        "start_time": new_start.isoformat(),
        "end_time": new_end.isoformat(),
        "created_at": now,
    }
    _, ref = db.collection("bookings").add(doc)
    return {
        "id": ref.id, 
        "location_id": payload.location_id,
        "location_name": location_name,  # ✅ Include location name in response
        "uid": user["uid"],
        "user_email": user.get("email", "unknown"),
        "start_time": new_start, 
        "end_time": new_end
    }

@router.get("", response_model=list[BookingOut])
def list_my_bookings(user = Depends(get_firebase_user)):
    """
    List bookings created by the current user with location names.
    """
    db = get_db()
    q = db.collection("bookings").where("uid", "==", user["uid"])
    out = []
    
    for d in q.stream():
        b = d.to_dict()
        
        # Lookup location name
        location_name = "Unknown Location"
        try:
            location_doc = db.collection("locations").document(b["location_id"]).get()
            if location_doc.exists:
                location_data = location_doc.to_dict()
                print(f"Fetched location data for booking {d.id}: {location_data}")
                location_name = location_data.get("name", "Unknown Location")
                print(f"Booking {d.id} is for location '{location_name}'")
            else:
                print(f"Warning: Location {b['location_id']} not found for booking {d.id}")
        except Exception as e:
            print(f"Error fetching location name for booking {d.id}: {e}")
        
        start_time_str = b["start_time"]
        end_time_str = b["end_time"]
        
        if hasattr(b["start_time"], 'isoformat'):
            start_time_str = b["start_time"].isoformat()
        elif isinstance(b["start_time"], str):
            # If already string, make sure it's properly formatted
            try:
                dt = datetime.fromisoformat(b["start_time"])
                start_time_str = dt.isoformat()
            except:
                start_time_str = b["start_time"]
                
        if hasattr(b["end_time"], 'isoformat'):
            end_time_str = b["end_time"].isoformat()
        elif isinstance(b["end_time"], str):
            try:
                dt = datetime.fromisoformat(b["end_time"])
                end_time_str = dt.isoformat()
            except:
                end_time_str = b["end_time"]
        
        booking_data = {
            "id": d.id,
            "location_id": b["location_id"],
            "location_name": location_name,  
            "uid": b.get("uid", user["uid"]),
            "user_email": b.get("user_email", user.get("email", "")),
            "start_time": start_time_str, 
            "end_time": end_time_str,      
        }
        
        print(f"Adding booking data: {booking_data}")
        out.append(booking_data)
    
    print(f"Returning {len(out)} bookings with location names for user {user['uid']}")
    print(out)
    return out

# List ALL bookings for a specific location (from all users). This allows users to see what times are already booked.
@router.get("/location/{location_id}")
def list_bookings_for_location(location_id: str, user = Depends(get_firebase_user)):
    db = get_db()
    
    # Verify location exists
    loc = db.collection("locations").document(location_id).get()
    if not loc.exists:
        raise HTTPException(404, "Location not found")
    
    # Get all bookings for this location
    q = db.collection("bookings").where("location_id", "==", location_id)
    bookings = []
    
    for d in q.stream():
        b = d.to_dict()
        bookings.append({
            "id": d.id,
            "location_id": b["location_id"],
            "start_time": b["start_time"],
            "end_time": b["end_time"],
            "booked_by": b.get("user_email", "Anonymous"),  # Show who booked it
            "is_mine": b.get("uid") == user["uid"]  # Flag if it's current user's booking
        })
    
    # Sort by start time
    bookings.sort(key=lambda x: x["start_time"])
    
    return {
        "location_id": location_id,
        "location_name": loc.to_dict().get("name", "Unknown"),
        "bookings": bookings,
        "total_bookings": len(bookings)
    }

@router.delete("/{booking_id}")
def delete_booking(booking_id: str, user = Depends(get_firebase_user)):
    """
    Delete a booking. Only the user who created it can delete it.
    """
    db = get_db()
    ref = db.collection("bookings").document(booking_id)
    snap = ref.get()
    
    if not snap.exists:
        raise HTTPException(404, "Booking not found")
    
    booking_data = snap.to_dict()
    if booking_data.get("uid") != user["uid"]:
        raise HTTPException(403, "You can only delete your own bookings")
    
    ref.delete()
    return {"ok": True, "message": "Booking deleted successfully"}