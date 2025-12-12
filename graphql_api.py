from typing import List, Optional
from datetime import datetime

import strawberry
from strawberry.fastapi import GraphQLRouter

from database import (
    get_mysql_conn,
    get_mongo_collection,
    get_redis_conn,
    get_mongo_db
)


# Use consistent Redis key format
def get_checkin_key(event_id: int) -> str:
    return f"event:{event_id}:checkins"


# ---------- GraphQL Types ----------

@strawberry.type
class StudentType:
    id: int
    guardianID: Optional[int]
    firstName: str
    lastName: str
    guardianName: Optional[str] = None


@strawberry.type
class LeaderType:
    id: int
    firstName: str
    lastName: str


@strawberry.type
class EventDetailsType:
    """Complete event details pulling from all 3 databases"""
    # From MySQL
    id: int
    Type: str
    Notes: str
    eventTypeid: Optional[int]

    # From Redis (live data)
    currentlyCheckedIn: List[int]
    liveAttendeeCount: int

    # From MongoDB (notes)
    meetingNotes: List[str]
    notesCount: int


@strawberry.type
class EventTypeType:
    id: int
    Type: str
    Notes: str
    eventTypeid: Optional[int]


@strawberry.type
class AttendanceRecordType:
    id: int
    eventId: int
    studentId: int
    theDATE: str
    theTime: str
    eventName: Optional[str] = None


@strawberry.type
class CheckInStatus:
    eventId: int
    studentId: int
    status: str


@strawberry.type
class PersistAttendanceResult:
    eventId: int
    count: int


@strawberry.type
class NoteType:
    id: str
    eventId: int
    text: str
    author: str
    createdAt: str


@strawberry.type
class MeetingNoteType:
    id: strawberry.ID
    eventId: int
    content: str
    createdAt: str


@strawberry.type
class SuccessResult:
    success: bool
    message: str


@strawberry.type
class GroupType:
    id: int
    name: str
    memberCount: int = 0
    members: List[StudentType] = strawberry.field(default_factory=list)
    leaders: List[LeaderType] = strawberry.field(default_factory=list)


@strawberry.type
class GroupMemberType:
    id: int
    groupId: int
    studentId: int
    groupName: Optional[str] = None
    studentName: Optional[str] = None


@strawberry.type
class VolunteerType:
    id: int
    firstName: str
    lastName: str


@strawberry.type
class VolunteerRecordType:
    id: int
    volunteerId: int
    eventId: int
    volunteerName: Optional[str] = None
    eventName: Optional[str] = None


# ---------- Query Resolvers (READ) ----------

@strawberry.type
class Query:
    @strawberry.field
    def students(self) -> List[StudentType]:
        """Get all students"""
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
                    SELECT s.ID                                 as id,
                           s.guardianID,
                           s.firstName,
                           s.lastName,
                           CONCAT(g.firstName, ' ', g.lastName) as guardianName
                    FROM Student s
                             LEFT JOIN Guardian g ON s.guardianID = g.ID
                    ORDER BY s.firstName
                    """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [StudentType(**row) for row in rows]

    @strawberry.field
    def studentById(self, studentId: int) -> Optional[StudentType]:
        """Get a single student by ID"""
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
                    SELECT s.ID                                 as id,
                           s.guardianID,
                           s.firstName,
                           s.lastName,
                           CONCAT(g.firstName, ' ', g.lastName) as guardianName
                    FROM Student s
                             LEFT JOIN Guardian g ON s.guardianID = g.ID
                    WHERE s.ID = %s
                    """, (studentId,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row:
            return StudentType(**row)
        return None

    @strawberry.field
    def studentAttendance(self, studentId: int) -> List[AttendanceRecordType]:
        """Get all attendance records for a student"""
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """
            SELECT a.ID        as id,
                   a.eventID   as eventId,
                   a.studentID as studentId,
                   a.theDATE,
                   a.theTime,
                   e.Type      as eventName
            FROM AttendanceStudent a
                     LEFT JOIN Event e ON a.eventID = e.ID
            WHERE a.studentID = %s
            ORDER BY a.theDATE DESC, a.theTime DESC
            """,
            (studentId,)
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()

        return [
            AttendanceRecordType(
                id=row['id'],
                eventId=row['eventId'],
                studentId=row['studentId'],
                theDATE=str(row['theDATE']),
                theTime=str(row['theTime']),
                eventName=row.get('eventName')
            ) for row in rows
        ]

    @strawberry.field
    def events(self) -> List[EventTypeType]:
        """Get all events"""
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT ID AS id, Type, Notes, event_typeID AS eventTypeid FROM Event ORDER BY ID"
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [EventTypeType(**row) for row in rows]

    @strawberry.field
    def eventById(self, eventId: int) -> Optional[EventTypeType]:
        """Get a single event by ID"""
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT ID AS id, Type, Notes, event_typeID AS eventTypeid FROM Event WHERE ID = %s",
            (eventId,)
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row:
            return EventTypeType(**row)
        return None

    @strawberry.field
    def checkedInStudents(self, eventId: int) -> List[int]:
        """Get list of student IDs currently checked in via Redis"""
        r = get_redis_conn()
        key = get_checkin_key(eventId)
        members = list(r.smembers(key))
        return [int(m) for m in members]

    @strawberry.field
    def meetingNotes(self, eventId: int) -> List[MeetingNoteType]:
        """Get all meeting notes for an event from MongoDB"""
        db = get_mongo_db()
        coll = db["meeting_notes"]

        docs = coll.find({"eventId": eventId}).sort("createdAt", -1)

        return [
            MeetingNoteType(
                id=str(doc["_id"]),
                eventId=doc["eventId"],
                content=doc["content"],
                createdAt=doc["createdAt"].isoformat(),
            )
            for doc in docs
        ]

    @strawberry.field
    def leaderById(self, leaderId: int) -> Optional[LeaderType]:
        """Verify a leader exists by ID (for login)"""
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT ID as id, firstName, lastName FROM Leader WHERE ID = %s",
            (leaderId,)
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row:
            return LeaderType(**row)
        return None

    @strawberry.field
    def eventDetails(self, eventId: int) -> Optional[EventDetailsType]:
        """
        MULTI-DATABASE QUERY: Combines data from MySQL, Redis, and MongoDB
        This demonstrates integration of all three database systems.
        """
        # 1. Fetch event data from MySQL
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT ID AS id, Type, Notes, event_typeID AS eventTypeid FROM Event WHERE ID = %s",
            (eventId,)
        )
        event_row = cur.fetchone()
        cur.close()
        conn.close()

        if not event_row:
            return None

        # 2. Fetch live check-ins from Redis
        r = get_redis_conn()
        key = get_checkin_key(eventId)
        checked_in = list(r.smembers(key))
        checked_in_ids = [int(c) for c in checked_in]

        # 3. Fetch meeting notes from MongoDB
        db = get_mongo_db()
        coll = db["meeting_notes"]
        docs = coll.find({"eventId": eventId}).sort("createdAt", -1)
        notes_list = [doc.get("content", "") for doc in docs]

        # Combine all data
        return EventDetailsType(
            id=event_row["id"],
            Type=event_row["Type"],
            Notes=event_row["Notes"],
            eventTypeid=event_row["eventTypeid"],
            currentlyCheckedIn=checked_in_ids,
            liveAttendeeCount=len(checked_in_ids),
            meetingNotes=notes_list,
            notesCount=len(notes_list)
        )

    @strawberry.field
    def groups(self) -> List[GroupType]:
        """Get all small groups with their members and leaders"""
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)

        # Get all groups
        cur.execute("SELECT ID as id, name FROM AGroup ORDER BY name")
        groups = cur.fetchall()

        result = []
        for group in groups:
            group_id = group['id']

            # Get members for this group
            cur.execute("""
                        SELECT s.ID                                 as id,
                               s.firstName,
                               s.lastName,
                               s.guardianID,
                               CONCAT(g.firstName, ' ', g.lastName) as guardianName
                        FROM GroupMember gm
                                 JOIN Student s ON gm.studentID = s.ID
                                 LEFT JOIN Guardian g ON s.guardianID = g.ID
                        WHERE gm.groupID = %s
                        ORDER BY s.firstName
                        """, (group_id,))
            members_data = cur.fetchall()
            members = [StudentType(**m) for m in members_data]

            # Get leaders for this group
            cur.execute("""
                        SELECT l.ID as id, l.firstName, l.lastName
                        FROM GroupLeader gl
                                 JOIN Leader l ON gl.leaderID = l.ID
                        WHERE gl.groupID = %s
                        ORDER BY l.firstName
                        """, (group_id,))
            leaders_data = cur.fetchall()
            leaders = [LeaderType(**l) for l in leaders_data]

            result.append(GroupType(
                id=group['id'],
                name=group['name'],
                memberCount=len(members),
                members=members,
                leaders=leaders
            ))

        cur.close()
        conn.close()
        return result

    @strawberry.field
    def groupById(self, groupId: int) -> Optional[GroupType]:
        """Get a single group by ID with members and leaders"""
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)

        # Get group
        cur.execute("SELECT ID as id, name FROM AGroup WHERE ID = %s", (groupId,))
        group = cur.fetchone()

        if not group:
            cur.close()
            conn.close()
            return None

        # Get members
        cur.execute("""
                    SELECT s.ID                                 as id,
                           s.firstName,
                           s.lastName,
                           s.guardianID,
                           CONCAT(g.firstName, ' ', g.lastName) as guardianName
                    FROM GroupMember gm
                             JOIN Student s ON gm.studentID = s.ID
                             LEFT JOIN Guardian g ON s.guardianID = g.ID
                    WHERE gm.groupID = %s
                    ORDER BY s.firstName
                    """, (groupId,))
        members_data = cur.fetchall()
        members = [StudentType(**m) for m in members_data]

        # Get leaders
        cur.execute("""
                    SELECT l.ID as id, l.firstName, l.lastName
                    FROM GroupLeader gl
                             JOIN Leader l ON gl.leaderID = l.ID
                    WHERE gl.groupID = %s
                    ORDER BY l.firstName
                    """, (groupId,))
        leaders_data = cur.fetchall()
        leaders = [LeaderType(**l) for l in leaders_data]

        cur.close()
        conn.close()

        return GroupType(
            id=group['id'],
            name=group['name'],
            memberCount=len(members),
            members=members,
            leaders=leaders
        )
        checked_in_ids = list(r.smembers(key))
        checked_in_list = [int(sid) for sid in checked_in_ids]

        # 3. Fetch meeting notes from MongoDB
        db = get_mongo_db()
        coll = db["meeting_notes"]
        notes_cursor = coll.find({"eventId": eventId})
        notes_list = [doc.get("content", "") for doc in notes_cursor]

        # 4. Combine all data into single response
        return EventDetailsType(
            id=event_row['id'],
            Type=event_row['Type'],
            Notes=event_row['Notes'],
            eventTypeid=event_row['eventTypeid'],
            currentlyCheckedIn=checked_in_list,
            liveAttendeeCount=len(checked_in_list),
            meetingNotes=notes_list,
            notesCount=len(notes_list)
        )

    @strawberry.field
    def volunteers(self) -> List[VolunteerType]:
        """Get all volunteers"""
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT ID as id, firstName, lastName FROM Volunteer ORDER BY firstName")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [VolunteerType(**row) for row in rows]

    @strawberry.field
    def volunteerById(self, volunteerId: int) -> Optional[VolunteerType]:
        """Get a single volunteer by ID"""
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT ID as id, firstName, lastName FROM Volunteer WHERE ID = %s", (volunteerId,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row:
            return VolunteerType(**row)
        return None

    @strawberry.field
    def volunteerRecords(self, volunteerId: Optional[int] = None, eventId: Optional[int] = None) -> List[
        VolunteerRecordType]:
        """Get volunteer records, optionally filtered by volunteer or event"""
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)

        if volunteerId:
            cur.execute("""
                        SELECT vr.ID                                as id,
                               vr.volunteerID                       as volunteerId,
                               vr.eventID                           as eventId,
                               CONCAT(v.firstName, ' ', v.lastName) as volunteerName,
                               e.Type                               as eventName
                        FROM VolunteerRecord vr
                                 JOIN Volunteer v ON vr.volunteerID = v.ID
                                 LEFT JOIN Event e ON vr.eventID = e.ID
                        WHERE vr.volunteerID = %s
                        ORDER BY vr.ID DESC
                        """, (volunteerId,))
        elif eventId:
            cur.execute("""
                        SELECT vr.ID                                as id,
                               vr.volunteerID                       as volunteerId,
                               vr.eventID                           as eventId,
                               CONCAT(v.firstName, ' ', v.lastName) as volunteerName,
                               e.Type                               as eventName
                        FROM VolunteerRecord vr
                                 JOIN Volunteer v ON vr.volunteerID = v.ID
                                 LEFT JOIN Event e ON vr.eventID = e.ID
                        WHERE vr.eventID = %s
                        ORDER BY vr.ID DESC
                        """, (eventId,))
        else:
            cur.execute("""
                        SELECT vr.ID                                as id,
                               vr.volunteerID                       as volunteerId,
                               vr.eventID                           as eventId,
                               CONCAT(v.firstName, ' ', v.lastName) as volunteerName,
                               e.Type                               as eventName
                        FROM VolunteerRecord vr
                                 JOIN Volunteer v ON vr.volunteerID = v.ID
                                 LEFT JOIN Event e ON vr.eventID = e.ID
                        ORDER BY vr.ID DESC
                        """)

        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [VolunteerRecordType(**row) for row in rows]


# ---------- Mutation Resolvers (CREATE, UPDATE, DELETE) ----------

@strawberry.type
class Mutation:
    # ==================== STUDENT CRUD ====================

    @strawberry.mutation
    def createStudent(
            self,
            firstName: str,
            lastName: str,
            guardianID: Optional[int] = None
    ) -> StudentType:
        """CREATE a new student"""
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "INSERT INTO Student (firstName, lastName, guardianID) VALUES (%s, %s, %s)",
            (firstName, lastName, guardianID)
        )
        conn.commit()
        student_id = cur.lastrowid
        cur.close()
        conn.close()

        return StudentType(
            id=student_id,
            firstName=firstName,
            lastName=lastName,
            guardianID=guardianID
        )

    @strawberry.mutation
    def updateStudent(
            self,
            studentId: int,
            firstName: Optional[str] = None,
            lastName: Optional[str] = None,
            guardianID: Optional[int] = None
    ) -> Optional[StudentType]:
        """UPDATE a student's information"""
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)

        # Build dynamic update query
        updates = []
        params = []

        if firstName is not None:
            updates.append("firstName = %s")
            params.append(firstName)
        if lastName is not None:
            updates.append("lastName = %s")
            params.append(lastName)
        if guardianID is not None:
            updates.append("guardianID = %s")
            params.append(guardianID)

        if not updates:
            cur.close()
            conn.close()
            return None

        params.append(studentId)
        query = f"UPDATE Student SET {', '.join(updates)} WHERE id = %s"

        cur.execute(query, params)
        conn.commit()

        # Fetch updated student
        cur.execute("SELECT id, firstName, lastName, guardianID FROM Student WHERE id = %s", (studentId,))
        row = cur.fetchone()
        cur.close()
        conn.close()

        if row:
            return StudentType(**row)
        return None

    @strawberry.mutation
    def deleteStudent(self, studentId: int) -> SuccessResult:
        """DELETE a student"""
        conn = get_mysql_conn()
        cur = conn.cursor()

        # First delete related records
        cur.execute("DELETE FROM AttendanceStudent WHERE studentID = %s", (studentId,))
        cur.execute("DELETE FROM GroupMember WHERE studentID = %s", (studentId,))
        cur.execute("DELETE FROM Student WHERE id = %s", (studentId,))

        conn.commit()
        affected = cur.rowcount
        cur.close()
        conn.close()

        return SuccessResult(
            success=affected > 0,
            message=f"Student {studentId} deleted successfully" if affected > 0 else "Student not found"
        )

    # ==================== EVENT CRUD ====================

    @strawberry.mutation
    def createEvent(
            self,
            Type: str,
            Notes: str,
            eventTypeId: int
    ) -> EventTypeType:
        """CREATE a new event"""
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "INSERT INTO Event (Type, Notes, event_typeID) VALUES (%s, %s, %s)",
            (Type, Notes, eventTypeId)
        )
        conn.commit()
        event_id = cur.lastrowid
        cur.close()
        conn.close()

        return EventTypeType(
            id=event_id,
            Type=Type,
            Notes=Notes,
            eventTypeid=eventTypeId
        )

    @strawberry.mutation
    def updateEvent(
            self,
            eventId: int,
            Type: Optional[str] = None,
            Notes: Optional[str] = None,
            eventTypeId: Optional[int] = None
    ) -> Optional[EventTypeType]:
        """UPDATE an event's information"""
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)

        updates = []
        params = []

        if Type is not None:
            updates.append("Type = %s")
            params.append(Type)
        if Notes is not None:
            updates.append("Notes = %s")
            params.append(Notes)
        if eventTypeId is not None:
            updates.append("event_typeID = %s")
            params.append(eventTypeId)

        if not updates:
            cur.close()
            conn.close()
            return None

        params.append(eventId)
        query = f"UPDATE Event SET {', '.join(updates)} WHERE ID = %s"

        cur.execute(query, params)
        conn.commit()

        # Fetch updated event
        cur.execute(
            "SELECT ID AS id, Type, Notes, event_typeID AS eventTypeid FROM Event WHERE ID = %s",
            (eventId,)
        )
        row = cur.fetchone()
        cur.close()
        conn.close()

        if row:
            return EventTypeType(**row)
        return None

    @strawberry.mutation
    def deleteEvent(self, eventId: int) -> SuccessResult:
        """DELETE an event"""
        conn = get_mysql_conn()
        cur = conn.cursor()

        # Delete related records
        cur.execute("DELETE FROM AttendanceStudent WHERE eventID = %s", (eventId,))
        cur.execute("DELETE FROM AttendanceRecord WHERE eventID = %s", (eventId,))
        cur.execute("DELETE FROM EventLeader WHERE eventID = %s", (eventId,))
        cur.execute("DELETE FROM VolunteerRecord WHERE eventID = %s", (eventId,))
        cur.execute("DELETE FROM Event WHERE ID = %s", (eventId,))

        conn.commit()
        affected = cur.rowcount
        cur.close()
        conn.close()

        # Also delete from MongoDB
        db = get_mongo_db()
        coll = db["meeting_notes"]
        coll.delete_many({"eventId": eventId})

        # Clear Redis check-ins
        r = get_redis_conn()
        r.delete(get_checkin_key(eventId))

        return SuccessResult(
            success=affected > 0,
            message=f"Event {eventId} deleted successfully" if affected > 0 else "Event not found"
        )

    # ==================== CHECK-INS & NOTES ====================

    @strawberry.mutation
    def addMeetingNote(self, eventId: int, content: str) -> MeetingNoteType:
        """Save a new meeting note for a given event into MongoDB"""
        db = get_mongo_db()
        coll = db["meeting_notes"]

        doc = {
            "eventId": eventId,
            "content": content,
            "createdAt": datetime.utcnow(),
        }

        result = coll.insert_one(doc)
        doc["_id"] = result.inserted_id

        return MeetingNoteType(
            id=str(doc["_id"]),
            eventId=doc["eventId"],
            content=doc["content"],
            createdAt=doc["createdAt"].isoformat(),
        )

    @strawberry.mutation
    def checkIn(self, eventId: int, studentId: int) -> CheckInStatus:
        """Check in a student to an event (stored in Redis)"""
        r = get_redis_conn()
        key = get_checkin_key(eventId)
        r.sadd(key, studentId)
        return CheckInStatus(eventId=eventId, studentId=studentId, status="checked_in")

    @strawberry.mutation
    def persistAttendance(self, eventId: int) -> PersistAttendanceResult:
        """Move checked-in set from Redis into AttendanceStudent in MySQL"""
        r = get_redis_conn()
        key = get_checkin_key(eventId)
        members = list(r.smembers(key))

        conn = get_mysql_conn()
        cur = conn.cursor()

        now = datetime.now()
        date_str = now.date().isoformat()
        time_str = now.time().replace(microsecond=0).isoformat()

        count = 0
        for m in members:
            sid = int(m)
            cur.execute(
                """
                INSERT INTO AttendanceStudent (eventID, studentID, theDATE, theTime)
                VALUES (%s, %s, %s, %s)
                """,
                (eventId, sid, date_str, time_str),
            )
            count += 1

        conn.commit()
        cur.close()
        conn.close()

        # Clear Redis key
        r.delete(key)

        return PersistAttendanceResult(eventId=eventId, count=count)

    # ==================== SMALL GROUPS CRUD ====================

    @strawberry.mutation
    def createGroup(self, name: str) -> GroupType:
        """CREATE a new small group"""
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "INSERT INTO AGroup (name) VALUES (%s)",
            (name,)
        )
        conn.commit()
        group_id = cur.lastrowid
        cur.close()
        conn.close()

        return GroupType(
            id=group_id,
            name=name,
            memberCount=0,
            members=[],
            leaders=[]
        )

    @strawberry.mutation
    def updateGroup(self, groupId: int, name: str) -> Optional[GroupType]:
        """UPDATE a group's name"""
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)

        cur.execute("UPDATE AGroup SET name = %s WHERE ID = %s", (name, groupId))
        conn.commit()

        if cur.rowcount == 0:
            cur.close()
            conn.close()
            return None

        # Get updated group with members and leaders
        cur.execute("SELECT ID as id, name FROM AGroup WHERE ID = %s", (groupId,))
        group = cur.fetchone()

        # Get members
        cur.execute("""
                    SELECT s.ID                                 as id,
                           s.firstName,
                           s.lastName,
                           s.guardianID,
                           CONCAT(g.firstName, ' ', g.lastName) as guardianName
                    FROM GroupMember gm
                             JOIN Student s ON gm.studentID = s.ID
                             LEFT JOIN Guardian g ON s.guardianID = g.ID
                    WHERE gm.groupID = %s
                    """, (groupId,))
        members_data = cur.fetchall()
        members = [StudentType(**m) for m in members_data]

        # Get leaders
        cur.execute("""
                    SELECT l.ID as id, l.firstName, l.lastName
                    FROM GroupLeader gl
                             JOIN Leader l ON gl.leaderID = l.ID
                    WHERE gl.groupID = %s
                    """, (groupId,))
        leaders_data = cur.fetchall()
        leaders = [LeaderType(**l) for l in leaders_data]

        cur.close()
        conn.close()

        return GroupType(
            id=group['id'],
            name=group['name'],
            memberCount=len(members),
            members=members,
            leaders=leaders
        )

    @strawberry.mutation
    def deleteGroup(self, groupId: int) -> SuccessResult:
        """DELETE a group"""
        conn = get_mysql_conn()
        cur = conn.cursor()

        # Delete related records
        cur.execute("DELETE FROM GroupMember WHERE groupID = %s", (groupId,))
        cur.execute("DELETE FROM GroupLeader WHERE groupID = %s", (groupId,))
        cur.execute("DELETE FROM AGroup WHERE ID = %s", (groupId,))

        conn.commit()
        affected = cur.rowcount
        cur.close()
        conn.close()

        return SuccessResult(
            success=affected > 0,
            message=f"Group {groupId} deleted successfully" if affected > 0 else "Group not found"
        )

    @strawberry.mutation
    def addStudentToGroup(self, groupId: int, studentId: int) -> SuccessResult:
        """ADD a student to a small group"""
        conn = get_mysql_conn()
        cur = conn.cursor()

        try:
            cur.execute(
                "INSERT INTO GroupMember (groupID, studentID) VALUES (%s, %s)",
                (groupId, studentId)
            )
            conn.commit()
            cur.close()
            conn.close()
            return SuccessResult(
                success=True,
                message=f"Student {studentId} added to group {groupId}"
            )
        except Exception as e:
            conn.rollback()
            cur.close()
            conn.close()
            return SuccessResult(
                success=False,
                message=f"Error: {str(e)}"
            )

    @strawberry.mutation
    def removeStudentFromGroup(self, groupId: int, studentId: int) -> SuccessResult:
        """REMOVE a student from a small group"""
        conn = get_mysql_conn()
        cur = conn.cursor()

        cur.execute(
            "DELETE FROM GroupMember WHERE groupID = %s AND studentID = %s",
            (groupId, studentId)
        )
        conn.commit()
        affected = cur.rowcount
        cur.close()
        conn.close()

        return SuccessResult(
            success=affected > 0,
            message=f"Student {studentId} removed from group {groupId}" if affected > 0 else "Member not found"
        )

    @strawberry.mutation
    def addLeaderToGroup(self, groupId: int, leaderId: int) -> SuccessResult:
        """ADD a leader to a small group"""
        conn = get_mysql_conn()
        cur = conn.cursor()

        try:
            cur.execute(
                "INSERT INTO GroupLeader (groupID, leaderID) VALUES (%s, %s)",
                (groupId, leaderId)
            )
            conn.commit()
            cur.close()
            conn.close()
            return SuccessResult(
                success=True,
                message=f"Leader {leaderId} added to group {groupId}"
            )
        except Exception as e:
            conn.rollback()
            cur.close()
            conn.close()
            return SuccessResult(
                success=False,
                message=f"Error: {str(e)}"
            )

    @strawberry.mutation
    def removeLeaderFromGroup(self, groupId: int, leaderId: int) -> SuccessResult:
        """REMOVE a leader from a small group"""
        conn = get_mysql_conn()
        cur = conn.cursor()

        cur.execute(
            "DELETE FROM GroupLeader WHERE groupID = %s AND leaderID = %s",
            (groupId, leaderId)
        )
        conn.commit()
        affected = cur.rowcount
        cur.close()
        conn.close()

        return SuccessResult(
            success=affected > 0,
            message=f"Leader {leaderId} removed from group {groupId}" if affected > 0 else "Leader not found"
        )

    # ==================== VOLUNTEERS CRUD ====================

    @strawberry.mutation
    def createVolunteer(self, firstName: str, lastName: str) -> VolunteerType:
        """CREATE a new volunteer"""
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "INSERT INTO Volunteer (firstName, lastName) VALUES (%s, %s)",
            (firstName, lastName)
        )
        conn.commit()
        volunteer_id = cur.lastrowid
        cur.close()
        conn.close()

        return VolunteerType(
            id=volunteer_id,
            firstName=firstName,
            lastName=lastName
        )

    @strawberry.mutation
    def updateVolunteer(
            self,
            volunteerId: int,
            firstName: Optional[str] = None,
            lastName: Optional[str] = None
    ) -> Optional[VolunteerType]:
        """UPDATE a volunteer's information"""
        conn = get_mysql_conn()
        cur = conn.cursor(dictionary=True)

        updates = []
        params = []

        if firstName is not None:
            updates.append("firstName = %s")
            params.append(firstName)
        if lastName is not None:
            updates.append("lastName = %s")
            params.append(lastName)

        if not updates:
            cur.close()
            conn.close()
            return None

        params.append(volunteerId)
        query = f"UPDATE Volunteer SET {', '.join(updates)} WHERE ID = %s"

        cur.execute(query, params)
        conn.commit()

        # Fetch updated volunteer
        cur.execute("SELECT ID as id, firstName, lastName FROM Volunteer WHERE ID = %s", (volunteerId,))
        row = cur.fetchone()
        cur.close()
        conn.close()

        if row:
            return VolunteerType(**row)
        return None

    @strawberry.mutation
    def deleteVolunteer(self, volunteerId: int) -> SuccessResult:
        """DELETE a volunteer"""
        conn = get_mysql_conn()
        cur = conn.cursor()

        # Delete related records
        cur.execute("DELETE FROM VolunteerRecord WHERE volunteerID = %s", (volunteerId,))
        cur.execute("DELETE FROM Volunteer WHERE ID = %s", (volunteerId,))

        conn.commit()
        affected = cur.rowcount
        cur.close()
        conn.close()

        return SuccessResult(
            success=affected > 0,
            message=f"Volunteer {volunteerId} deleted successfully" if affected > 0 else "Volunteer not found"
        )

    @strawberry.mutation
    def addVolunteerToEvent(self, volunteerId: int, eventId: int) -> SuccessResult:
        """ADD a volunteer to an event"""
        conn = get_mysql_conn()
        cur = conn.cursor()

        try:
            cur.execute(
                "INSERT INTO VolunteerRecord (volunteerID, eventID) VALUES (%s, %s)",
                (volunteerId, eventId)
            )
            conn.commit()
            cur.close()
            conn.close()
            return SuccessResult(
                success=True,
                message=f"Volunteer {volunteerId} added to event {eventId}"
            )
        except Exception as e:
            conn.rollback()
            cur.close()
            conn.close()
            return SuccessResult(
                success=False,
                message=f"Error: {str(e)}"
            )

    @strawberry.mutation
    def removeVolunteerFromEvent(self, volunteerId: int, eventId: int) -> SuccessResult:
        """REMOVE a volunteer from an event"""
        conn = get_mysql_conn()
        cur = conn.cursor()

        cur.execute(
            "DELETE FROM VolunteerRecord WHERE volunteerID = %s AND eventID = %s",
            (volunteerId, eventId)
        )
        conn.commit()
        affected = cur.rowcount
        cur.close()
        conn.close()

        return SuccessResult(
            success=affected > 0,
            message=f"Volunteer {volunteerId} removed from event {eventId}" if affected > 0 else "Record not found"
        )


schema = strawberry.Schema(query=Query, mutation=Mutation)
graphql_app = GraphQLRouter(schema)