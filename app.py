import mysql.connector
import uvicorn
from mysql.connector import errorcode
from fastapi import FastAPI, HTTPException

DB_USER="root"
DB_PASSWORD="***REMOVED***"
DB_HOST="127.0.0.1"
DB_NAME="youth_db"
def get_connection():
    cnx= mysql.connector.connect(
        user="root",
        password="***REMOVED***",
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
        cnx = get_connection()
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
        cnx = get_connection()
        cursor = cnx.cursor(dictionary=True)
        # Use parameterized query to prevent SQL injection
        query = "SELECT id, guardianID, firstName, lastName FROM Student WHERE id = %s;"
        cursor.execute(query, (student_id,))
        student = cursor.fetchone()
        if not student:
            raise HTTPException(status_code=404, detail="Customer not found")
        return student
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"Database error: {err}")
    finally:
        if 'cnx' in locals() and cnx.is_connected():
            cursor.close()
            cnx.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app)