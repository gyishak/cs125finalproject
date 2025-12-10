from typing import List, Optional

import strawberry
from strawberry.fastapi import GraphQLRouter

from database import get_db_connection, get_redis_conn, get_mongo_db


# ---------- GraphQL Types ----------

@strawberry.type
class StudentType:
    id: int
    guardianID: Optional[int]
    firstName: str
    lastName: str


@strawberry.type
class EventType:
    id: int
    Type: str
    Notes: Optional[str]
    eventTypeid: Optional[int]


@strawberry.type
class AttendanceEntryType:
    id: int
    eventId: int
    studentId: int
    theDATE: str
    theTime: str
    eventName: Optional[str]


@strawberry.input
class EventFieldInput:
    type: str
    note: str


# ---------- Query Resolvers ----------

@strawberry.type
class Query:
    @strawberry.field
    def students(self) -> List[StudentType]:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)
        try:
            cursor.execute(
                "SELECT id, guardianID, firstName, lastName FROM Student;"
            )
            rows = cursor.fetchall()
            return [
                StudentType(
                    id=row["id"],
                    guardianID=row.get("guardianID"),
                    firstName=row["firstName"],
                    lastName=row["lastName"],
                )
                for row in rows
            ]
        finally:
            cursor.close()
            cnx.close()

    @strawberry.field
    def studentById(self, studentId: int) -> Optional[StudentType]:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)
        try:
            cursor.execute(
                "SELECT id, guardianID, firstName, lastName "
                "FROM Student WHERE id = %s;",
                (studentId,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return StudentType(
                id=row["id"],
                guardianID=row.get("guardianID"),
                firstName=row["firstName"],
                lastName=row["lastName"],
            )
        finally:
            cursor.close()
            cnx.close()

    @strawberry.field
    def events(self) -> List[EventType]:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)
        try:
            cursor.execute(
                "SELECT ID AS id, Type, Notes, event_typeID AS eventTypeid "
                "FROM Event;"
            )
            rows = cursor.fetchall()
            return [
                EventType(
                    id=row["id"],
                    Type=row["Type"],
                    Notes=row.get("Notes"),
                    eventTypeid=row.get("eventTypeid"),
                )
                for row in rows
            ]
        finally:
            cursor.close()
            cnx.close()

    @strawberry.field
    def checkedInStudents(self, eventId: int) -> List[int]:
        """
        Read the live check-ins from Redis.
        """
        r = get_redis_conn()
        key = f"event {eventId}:checkIn"
        members = list(r.smembers(key))  # strings
        # convert to ints where possible
        ids: List[int] = []
        for m in members:
            try:
                ids.append(int(m))
            except ValueError:
                continue
        return ids

    @strawberry.field
    def studentAttendance(self, studentId: int) -> List[AttendanceEntryType]:
        """
        Attendance history for a specific student, from MySQL AttendanceStudent.
        """
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)
        try:
            cursor.execute(
                """
                SELECT a.ID AS id,
                       a.eventID AS eventId,
                       a.studentID AS studentId,
                       a.theDATE AS theDATE,
                       a.theTime AS theTime,
                       e.Type AS eventName
                FROM AttendanceStudent a
                LEFT JOIN Event e ON a.eventID = e.ID
                WHERE a.studentID = %s
                ORDER BY a.theDATE DESC, a.theTime DESC, a.ID DESC;
                """,
                (studentId,),
            )
            rows = cursor.fetchall()
            return [
                AttendanceEntryType(
                    id=row["id"],
                    eventId=row["eventId"],
                    studentId=row["studentId"],
                    theDATE=str(row["theDATE"]),
                    theTime=str(row["theTime"]),
                    eventName=row.get("eventName"),
                )
                for row in rows
            ]
        finally:
            cursor.close()
            cnx.close()


# ---------- Mutation Resolvers ----------

@strawberry.type
class Mutation:
    @strawberry.mutation
    def persistAttendance(self, eventId: int) -> bool:
        """
        Read live check-ins from Redis, save into MySQL AttendanceStudent,
        then clear the Redis key.
        """
        import datetime

        r = get_redis_conn()
        redis_key = f"event {eventId}:checkIn"
        members = list(r.smembers(redis_key))
        if not members:
            # Nothing to persist
            return False

        cnx = get_db_connection()
        cursor = cnx.cursor()
        try:
            now = datetime.datetime.now()
            date_str = now.date().isoformat()
            time_str = now.time().strftime("%H:%M:%S")

            for m in members:
                try:
                    student_id = int(m)
                except ValueError:
                    continue

                cursor.execute(
                    """
                    INSERT INTO AttendanceStudent (eventID, studentID, theDATE, theTime)
                    VALUES (%s, %s, %s, %s);
                    """,
                    (eventId, student_id, date_str, time_str),
                )

            cnx.commit()
            r.delete(redis_key)
            return True
        finally:
            cursor.close()
            cnx.close()

    @strawberry.mutation
    def createEventType(self, name: str, fields: List[EventFieldInput]) -> bool:
        """
        Create a new EVENT_TYPE row in MySQL and a matching MongoDB
        document with flexible fields. This shows GraphQL touching
        MySQL + MongoDB together.
        """
        # --- MySQL insert ---
        cnx = get_db_connection()
        cursor = cnx.cursor()
        try:
            cursor.execute(
                "INSERT INTO EVENT_TYPE (name) VALUES (%s);",
                (name,),
            )
            cnx.commit()
            event_type_id = cursor.lastrowid
        finally:
            cursor.close()
            cnx.close()

        # --- MongoDB insert ---
        db = get_mongo_db()
        coll = db["event_types"]

        doc = {
            "event-id": event_type_id,
            "name": name,
            "fields": [
                {"Type": f.type, "Notes": f.note}
                for f in fields
            ],
        }
        coll.insert_one(doc)

        return True


schema = strawberry.Schema(query=Query, mutation=Mutation)

# This is what app.py imports
graphql_app = GraphQLRouter(schema)
