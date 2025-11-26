import os
from flask import Flask, jsonify, request
from flask_mysqldb import MySQL
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ---- MySQL config from environment variables ----
app.config['MYSQL_HOST'] = os.environ.get('MYSQL_HOST', 'localhost')
app.config['MYSQL_USER'] = os.environ.get('MYSQL_USER', 'root')
app.config['MYSQL_PASSWORD'] = os.environ.get('MYSQL_PASSWORD', '')
app.config['MYSQL_DB'] = os.environ.get('MYSQL_DB', 'YouthGroup')
app.config['MYSQL_CURSORCLASS'] = 'DictCursor'  # return rows as dicts

mysql = MySQL(app)


@app.route("/")
def health():
    return {"status": "ok"}


# ========== STUDENT CRUD ==========

@app.route("/students", methods=["GET"])
def get_students():
    """List all students with their guardian."""
    cur = mysql.connection.cursor()
    cur.execute("""
        SELECT
            S.ID,
            S.FirstName,
            S.LastName,
            G.FirstName AS GuardianFirstName,
            G.LastName  AS GuardianLastName
        FROM Student S
        LEFT JOIN Guardian G ON S.GuardianID = G.ID
        ORDER BY S.LastName, S.FirstName;
    """)
    rows = cur.fetchall()
    cur.close()
    return jsonify(rows), 200


@app.route("/students", methods=["POST"])
def create_student():
    """Create a new student."""
    data = request.get_json(force=True)
    guardian_id = data.get("GuardianID")
    first = data.get("FirstName")
    last = data.get("LastName")

    if not first or not last:
        return {"error": "FirstName and LastName are required"}, 400

    cur = mysql.connection.cursor()
    cur.execute(
        "INSERT INTO Student (GuardianID, FirstName, LastName) VALUES (%s, %s, %s)",
        (guardian_id, first, last),
    )
    mysql.connection.commit()
    new_id = cur.lastrowid
    cur.close()

    return {"ID": new_id, "FirstName": first, "LastName": last}, 201


@app.route("/students/<int:student_id>", methods=["PUT"])
def update_student(student_id):
    """Update an existing student."""
    data = request.get_json(force=True)
    guardian_id = data.get("GuardianID")
    first = data.get("FirstName")
    last = data.get("LastName")

    cur = mysql.connection.cursor()
    cur.execute(
        """
        UPDATE Student
        SET GuardianID = %s, FirstName = %s, LastName = %s
        WHERE ID = %s
        """,
        (guardian_id, first, last, student_id),
    )
    mysql.connection.commit()
    cur.close()

    return {"message": "student updated"}, 200


@app.route("/students/<int:student_id>", methods=["DELETE"])
def delete_student(student_id):
    """Delete a student."""
    cur = mysql.connection.cursor()
    cur.execute("DELETE FROM Student WHERE ID = %s", (student_id,))
    mysql.connection.commit()
    cur.close()
    return {"message": "student deleted"}, 200


# ========== EVENTS & ATTENDANCE ==========

@app.route("/events", methods=["GET"])
def list_events():
    """List all events."""
    cur = mysql.connection.cursor()
    cur.execute("SELECT ID, Type, Notes FROM Event ORDER BY ID;")
    rows = cur.fetchall()
    cur.close()
    return jsonify(rows), 200


@app.route("/events", methods=["POST"])
def create_event():
    """Create a new event."""
    data = request.get_json(force=True)
    event_type = data.get("Type")
    notes = data.get("Notes", "")

    if not event_type:
        return {"error": "Type is required"}, 400

    cur = mysql.connection.cursor()
    cur.execute(
        "INSERT INTO Event (Type, Notes) VALUES (%s, %s)",
        (event_type, notes),
    )
    mysql.connection.commit()
    new_id = cur.lastrowid
    cur.close()

    return {"ID": new_id, "Type": event_type, "Notes": notes}, 201


@app.route("/events/<int:event_id>/attendance", methods=["GET"])
def list_attendance(event_id):
    """List attendance records for a given event."""
    cur = mysql.connection.cursor()
    cur.execute(
        """
        SELECT ID, EventID, Date, Time, RSVP
        FROM AttendanceRecord
        WHERE EventID = %s
        ORDER BY Date, Time;
        """,
        (event_id,),
    )
    rows = cur.fetchall()
    cur.close()
    return jsonify(rows), 200


@app.route("/events/<int:event_id>/attendance", methods=["POST"])
def add_attendance(event_id):
    """
    Add an attendance record for an event.
    JSON example:
    {
      "Date": "2025-01-10",
      "Time": "18:00:00",
      "RSVP": true
    }
    """
    data = request.get_json(force=True)
    date = data.get("Date")
    time = data.get("Time")
    rsvp = data.get("RSVP", True)

    if not date or not time:
        return {"error": "Date and Time are required"}, 400

    cur = mysql.connection.cursor()
    cur.execute(
        """
        INSERT INTO AttendanceRecord (EventID, Date, Time, RSVP)
        VALUES (%s, %s, %s, %s)
        """,
        (event_id, date, time, bool(rsvp)),
    )
    mysql.connection.commit()
    new_id = cur.lastrowid
    cur.close()

    return {"ID": new_id, "EventID": event_id}, 201


if __name__ == "__main__":
    app.run(debug=True)
