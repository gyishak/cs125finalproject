from tkinter import EventType
from typing import List, Optional, Any
from pydantic import BaseModel, Field as PydanticField
from bson import ObjectId
import mysql.connector
from fastapi import FastAPI, HTTPException
from database import get_db_connection, get_mongo_db, get_redis_conn, close_connections, get_mysql_pool, get_mongo_client, get_redis_client
import redis
DB_USER="root"
DB_PASSWORD="cs125"
DB_HOST="127.0.0.1"
DB_NAME="youth_db"
def get_connection():
    cnx= mysql.connector.connect(
        user="root",
        password="cs125",
        host=DB_HOST,
        port=3399,
        database="youth_db"
    )
    return cnx

app=FastAPI(
    title="Church Youth Ministry",
    description="An API for the church youth group ministry/program database",
    version="1.0.0",
)
@app.get("/students")
def get_all_students():
    """
    Retrieves a list of all students.
    """
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)
        cursor.execute("SELECT id, guardianID, firstName, lastName FROM Student")
        students = cursor.fetchall()
        return students
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"Database error: {err}")
    finally:
        if 'cnx' in locals() and cnx.is_connected():
            cursor.close()
            cnx.close()

@app.get("/student/{student_id}")
def get_student_by_id(student_id: int):
    """
    Retrieves a specific customer by their ID.
    """
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)
        query = "SELECT id, guardianID, firstName, lastName FROM Student WHERE id = %s;"
        cursor.execute(query, (student_id,))
        student = cursor.fetchone()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        return student
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"Database error: {err}")
    finally:
        if 'cnx' in locals() and cnx.is_connected():
            cursor.close()
            cnx.close()


# --- Pydantic Models for MongoDB Data ---
from typing import List, Optional, Any
from bson import ObjectId

class PyObjectId(ObjectId):
    # @classmethod
    # def __get_pydantic_core_schema__(
    #     cls, source: Any, handler: GetCoreSchemaHandler
    # ) -> core_schema.CoreSchema:
    #     """
    #     Return a Pydantic CoreSchema that defines how to validate and serialize ObjectIds.
    #     """
    #     return core_schema.json_or_python_schema(
    #         json_schema=core_schema.str_schema(),
    #         python_schema=core_schema.union_schema(
    #             [
    #                 core_schema.is_instance_schema(ObjectId),
    #                 core_schema.no_info_plain_validator_function(cls.validate),
    #             ]
    #         ),
    #         serialization=core_schema.plain_serializer_function_ser_schema(str),
    #     )

    @classmethod
    def validate(cls, v: Any) -> ObjectId:
        """Validate that the input is a valid ObjectId."""
        if isinstance(v, ObjectId):
            return v
        if ObjectId.is_valid(v):
            return ObjectId(v)
        raise ValueError("Invalid ObjectId")

class myField(BaseModel):
    type: str
    note: str

class myEventType(BaseModel):
    name: str
    fields: List[myField]

@app.post("/events-types")
def create_eventType(event_type: myEventType):
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)
        cursor.execute("INSERT INTO EVENT_TYPE  (name) VALUES (%s);", (event_type.name,))
        cnx.commit()
        event_typeId = cursor.lastrowid

    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"Database error: {err}")
    finally:
        if 'cnx' in locals() and cnx.is_connected():
            cursor.close()
            cnx.close()
    db = get_mongo_db()
    events_collection = db["event_types"]
    try:
        event_data = {
                        "event-id": event_typeId,
                        "name": event_type.name,
                        "fields": [
                            {
                                "Type": afield.type,
                                "Notes": afield.note
                            }
                                for afield in event_type.fields
                        ]
                    }
        print(event_data)
        event=events_collection.insert_one(event_data)
        return {"eventType": event_typeId, "mongo_id": str(event.inserted_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {e}")
    finally:
        if 'cursor' in locals():
            cursor.close()


# --- Pydantic Model for Redis Data ---
class checkInEvent(BaseModel):
    eventID: int
    studentID: int

@app.post("/event/check-in")
def checkIn_event(check_in: checkInEvent):
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)
        cursor.execute("SELECT ID FROM Event  WHERE ID = (%s)", (check_in.eventID,))
        event=cursor.fetchone()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        r=get_redis_conn()
        r.sadd(f"event {check_in.eventID}:checkIn", check_in.studentID)
        return {"event_id": check_in.eventID, "student_id": check_in.studentID, "student_status": "checked_in"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {e}")
    finally:
        if 'cursor' in locals():
            cursor.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app)
