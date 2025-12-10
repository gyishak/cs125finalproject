# extra_routes.py
from datetime import datetime
from typing import List, Optional

import mysql.connector
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_db_connection, get_mongo_db, get_redis_conn

router = APIRouter()

# ---------- Models ----------

class EventCreate(BaseModel):
    event_typeID: int
    Type: str
    Notes: Optional[str] = None


class Event(BaseModel):
    id: int
    event_typeID: int
    Type: str
    Notes: Optional[str] = None


class EventNoteCreate(BaseModel):
    note: str
    author: Optional[str] = None
    tags: Optional[List[str]] = None


# ============================================================
# Event CRUD (MySQL)
# ============================================================

@router.get("/events", response_model=List[Event])
def get_all_events():
    """Get all events from MySQL."""
    cnx = None
    cursor = None
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)
        cursor.execute("SELECT id, event_typeID, Type, Notes FROM Event;")
        rows = cursor.fetchall()
        return rows
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"Database error: {err}")
    finally:
        if cursor:
            cursor.close()
        if cnx and cnx.is_connected():
            cnx.close()


@router.get("/events/{event_id}", response_model=Event)
def get_event_by_id(event_id: int):
    """Get a single event by ID."""
    cnx = None
    cursor = None
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, event_typeID, Type, Notes FROM Event WHERE id = %s;",
            (event_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Event not found")
        return row
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"Database error: {err}")
    finally:
        if cursor:
            cursor.close()
        if cnx and cnx.is_connected():
            cnx.close()


@router.post("/events", response_model=Event, status_code=201)
def create_event(event: EventCreate):
    """Create a new event in MySQL."""
    cnx = None
    cursor = None
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)
        sql = """
            INSERT INTO Event (event_typeID, Type, Notes)
            VALUES (%s, %s, %s);
        """
        cursor.execute(sql, (event.event_typeID, event.Type, event.Notes))
        cnx.commit()
        new_id = cursor.lastrowid
        return Event(id=new_id, **event.model_dump())
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"Database error: {err}")
    finally:
        if cursor:
            cursor.close()
        if cnx and cnx.is_connected():
            cnx.close()


# ============================================================
# Redis: live check-ins
# ============================================================

@router.get("/event/{event_id}/checked-in")
def get_checked_in_students(event_id: int):
    """
    Return list of student IDs currently checked in (from Redis).
    """
    r = get_redis_conn()
    # Match the key pattern from app.py /event/check-in
    redis_key = f"event {event_id}:checkIn"
    student_ids = list(r.smembers(redis_key))  # Redis returns strings
    return {"event_id": event_id, "checked_in_students": student_ids}

@router.post("/event/{event_id}/persist-attendance")
def persist_attendance(event_id: int):
    """
    End-of-event: read check-ins from Redis and write them
    as AttendanceRecord rows in MySQL, then clear Redis key.
    NOTE: your AttendanceRecord table currently does not have studentID,
    so we just record that the event had attendance.
    """
    r = get_redis_conn()
    redis_key = f"event {event_id}:checkIn"
    student_ids = list(r.smembers(redis_key))

    if not student_ids:
        return {
            "event_id": event_id,
            "persisted": 0,
            "message": "No check-ins found in Redis.",
        }

    cnx = None
    cursor = None
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor()
        now = datetime.now()
        date_str = now.date().isoformat()
        time_str = now.time().replace(microsecond=0).isoformat()

        insert_sql = """
            INSERT INTO AttendanceRecord (eventID, theDATE, theTime, RSVP)
            VALUES (%s, %s, %s, %s);
        """

        for _sid in student_ids:
            cursor.execute(insert_sql, (event_id, date_str, time_str, "YES"))

        cnx.commit()

        # Clear Redis key
        r.delete(redis_key)

        return {
            "event_id": event_id,
            "persisted": len(student_ids),
            "message": "Attendance persisted to MySQL and Redis key cleared.",
        }
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"Database error: {err}")
    finally:
        if cursor:
            cursor.close()
        if cnx and cnx.is_connected():
            cnx.close()


# ============================================================
# MongoDB: event notes linked to MySQL Event
# ============================================================

@router.post("/event/{event_id}/notes", status_code=201)
def add_event_note(event_id: int, payload: EventNoteCreate):
    """
    Add a meeting note for a given event_id into MongoDB.
    """
    # Optional: verify event exists
    cnx = None
    cursor = None
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor()
        cursor.execute("SELECT ID FROM Event WHERE ID = %s;", (event_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Event not found")
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"Database error: {err}")
    finally:
        if cursor:
            cursor.close()
        if cnx and cnx.is_connected():
            cnx.close()

    db = get_mongo_db()
    notes_coll = db["event_notes"]

    doc = {
        "mysql_event_id": event_id,
        "note": payload.note,
        "author": payload.author,
        "tags": payload.tags or [],
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    result = notes_coll.insert_one(doc)
    return {"mongo_id": str(result.inserted_id), "event_id": event_id}


@router.get("/event/{event_id}/notes")
def list_event_notes(event_id: int):
    """
    List all MongoDB notes for a given event.
    """
    db = get_mongo_db()
    notes_coll = db["event_notes"]

    docs = notes_coll.find({"mysql_event_id": event_id}).sort("created_at", 1)
    notes = []
    for d in docs:
        notes.append(
            {
                "id": str(d.get("_id")),
                "note": d.get("note"),
                "author": d.get("author"),
                "tags": d.get("tags", []),
                "created_at": d.get("created_at"),
            }
        )
    return {"event_id": event_id, "notes": notes}
