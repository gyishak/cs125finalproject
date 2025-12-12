from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import mysql.connector
from bson import ObjectId
from pydantic import BaseModel
from typing import Any, List
import redis
import os
from database import (
    get_db_connection,
    get_mongo_db,
    get_redis_conn,
    close_connections,
    get_mysql_pool,
    get_mongo_client,
    get_redis_client,
)
from extra_routes import router as extra_router
from graphql_api import graphql_app
from fastapi.responses import FileResponse


# ------------------------------------------------------------------------------
# APP LIFECYCLE
# ------------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Application startup: initializing DB pools...")
    get_mysql_pool()
    get_mongo_client()
    get_redis_client()
    yield
    print("Application shutdown: closing DB pools...")
    close_connections()


app = FastAPI(
    title="Church Youth Ministry",
    description="API for youth group events, students, attendance & notes",
    version="2.0",
    lifespan=lifespan
)


# ------------------------------------------------------------------------------
# CORS
# ------------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------------------
# ROUTERS
# ------------------------------------------------------------------------------
app.include_router(extra_router)
app.include_router(graphql_app, prefix="/graphql")

@app.get("/events")
def get_all_events():
    """Return all events for the dashboard."""
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                ID AS id,
                Type AS type,
                Notes AS notes,
                eventTypeID AS eventTypeId
            FROM Event
            ORDER BY ID
        """)
        events = cursor.fetchall()
        return events

    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"MySQL Error: {err}")

    finally:
        if "cursor" in locals(): cursor.close()
        if "cnx" in locals() and cnx.is_connected(): cnx.close()


@app.get("/students")
def get_all_students():
    """Return all students for the dashboard."""
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                s.ID as id,
                s.guardianID,
                s.firstName,
                s.lastName,
                CONCAT(g.firstName, ' ', g.lastName) as guardianName
            FROM Student s
            LEFT JOIN Guardian g ON s.guardianID = g.ID
            ORDER BY s.id
        """)
        students = cursor.fetchall()
        return students

    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"MySQL Error: {err}")

    finally:
        if "cursor" in locals(): cursor.close()
        if "cnx" in locals() and cnx.is_connected(): cnx.close()


# ------------------------------------------------------------------------------
# EVENT-TYPE MONGO + REDIS ENDPOINTS (Your existing logic)
# ------------------------------------------------------------------------------

class myField(BaseModel):
    type: str
    note: str

class myEventType(BaseModel):
    name: str
    fields: List[myField]


@app.post("/events-types")
def create_eventType(event_type: myEventType):
    """Create new EventType in MySQL + Mongo."""
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)

        cursor.execute(
            "INSERT INTO EVENT_TYPE (name) VALUES (%s);",
            (event_type.name,)
        )
        cnx.commit()
        event_type_id = cursor.lastrowid

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MySQL error: {e}")

    finally:
        if "cursor" in locals(): cursor.close()
        if "cnx" in locals() and cnx.is_connected(): cnx.close()

    # Now insert into Mongo
    try:
        db = get_mongo_db()
        coll = db["event_types"]

        document = {
            "event-id": event_type_id,
            "name": event_type.name,
            "fields": [{"Type": f.type, "Notes": f.note} for f in event_type.fields]
        }

        result = coll.insert_one(document)
        return {"mysql_id": event_type_id, "mongo_id": str(result.inserted_id)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mongo error: {e}")


# ------------------------------------------------------------------------------
# REDIS CHECK-IN ENDPOINTS
# ------------------------------------------------------------------------------

class CheckInEvent(BaseModel):
    eventID: int
    studentID: int

@app.post("/event/check-in")
def check_in_student(check: CheckInEvent):
    """Write a student check-in to Redis."""
    try:
        # Validate event exists
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)

        cursor.execute("SELECT ID FROM Event WHERE ID = %s", (check.eventID,))
        event = cursor.fetchone()

        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        r = get_redis_conn()
        r.sadd(f"event:{check.eventID}:checkins", check.studentID)

        return {
            "event_id": check.eventID,
            "student_id": check.studentID,
            "status": "checked_in"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Redis error: {e}")

    finally:
        if "cursor" in locals(): cursor.close()
        if "cnx" in locals() and cnx.is_connected(): cnx.close()


@app.get("/")
@app.get("/leader-login.html")
def login_page():
    return FileResponse("frontend/leader-login.html")

@app.get("/index.html")
def index_page():
    return FileResponse("frontend/index.html")

@app.get("/student.html")
def student_page():
    return FileResponse("frontend/student.html")

@app.get("/styles.css")
def styles():
    return FileResponse("frontend/styles.css")

@app.get("/app.js")
def app_js():
    return FileResponse("frontend/app.js")

@app.get("/student.js")
def student_js():
    return FileResponse("frontend/student.js")

@app.get("/leader-login.js")
def leader_login_js():
    return FileResponse("frontend/leader-login.js")
# ------------------------------------------------------------------------------
# RUN APP
# ------------------------------------------------------------------------------


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", reload=True, host="0.0.0.0", port=8000)