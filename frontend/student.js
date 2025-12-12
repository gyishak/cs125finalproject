const GRAPHQL_URL = "http://localhost:8000/graphql";

// ============================================================
// GraphQL Request Helper
// ============================================================

async function gqlRequest(query, variables = {}) {
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    const json = await res.json();
    console.log("GraphQL response:", json);

    if (json.errors && json.errors.length > 0) {
      throw new Error(json.errors[0].message);
    }

    return json.data;
  } catch (err) {
    console.error("GraphQL error:", err);
    throw err;
  }
}

// ============================================================
// Student Lookup View
// ============================================================

function renderLookup() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="dashboard-grid">
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Find Student</h2>
          <span class="card-tag">Lookup</span>
        </div>
        <p class="card-subtitle">
          Enter a student ID to view their information and attendance history
        </p>
        
        <form id="lookup-form">
          <div class="form-group">
            <label class="form-label" for="student-id-input">Student ID</label>
            <input 
              type="number" 
              id="student-id-input" 
              placeholder="e.g., 1, 2, 3, 4" 
              required 
              min="1"
            />
          </div>
          <button type="submit">View Student</button>
        </form>
        
        <div class="empty-state" style="margin-top: 20px;">
          💡 Tip: In your sample data, student IDs 1–4 are valid
        </div>
      </div>

      <!-- Info Card -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">About This Portal</h2>
          <span class="card-tag">Info</span>
        </div>
        <p class="card-subtitle">
          Students and parents can use this portal to:
        </p>
        <ul style="margin-left: 20px; line-height: 1.8; color: #4a5568;">
          <li>View attendance history</li>
          <li>See upcoming events</li>
          <li>Check registration status</li>
          <li>Review guardian information</li>
        </ul>
      </div>
    </div>
  `;

  const form = document.getElementById("lookup-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById("student-id-input").value, 10);
    if (!id || id < 1) {
      alert("Please enter a valid student ID");
      return;
    }
    renderStudentDashboard(id);
  });
}

// ============================================================
// Student Dashboard View
// ============================================================

async function renderStudentDashboard(studentId) {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Loading Student ${studentId}...</h2>
      </div>
      <div class="spinner"></div>
    </div>
  `;

  const query = `
    query StudentDashboard($studentId: Int!) {
      studentById(studentId: $studentId) {
        id
        firstName
        lastName
        guardianID
        guardianName
      }
      studentAttendance(studentId: $studentId) {
        id
        eventId
        eventName
        theDATE
        theTime
      }
      events {
        id
        Type
        Notes
      }
    }
  `;

  try {
    const data = await gqlRequest(query, { studentId });

    if (!data.studentById) {
      app.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Student Not Found</h2>
            <span class="card-tag">Error</span>
          </div>
          <div class="status-text status-error">
            No student found with ID ${studentId}. Please check the ID and try again.
          </div>
          <button id="back-btn" style="margin-top: 20px;">Back to Search</button>
        </div>
      `;
      document
        .getElementById("back-btn")
        .addEventListener("click", renderLookup);
      return;
    }

    const student = data.studentById;
    const attendance = data.studentAttendance || [];
    const events = data.events || [];

    // Build attendance list HTML
    const attendanceHTML =
      attendance.length > 0
        ? `<div class="item-list">
          ${attendance
            .map(
              (a) => `
            <div class="attendance-item">
              <div>
                <div class="attendance-date">${a.theDATE} at ${a.theTime}</div>
                <div class="attendance-event">
                  ${a.eventName || `Event #${a.eventId}`}
                </div>
              </div>
              <div class="card-tag">✓ Present</div>
            </div>
          `
            )
            .join("")}
        </div>`
        : `<div class="empty-state">No attendance records yet for this student</div>`;

    // Build events list HTML
    const eventsHTML =
      events.length > 0
        ? `<div class="item-list">
          ${events
            .map(
              (e) => `
            <div class="item">
              <div class="item-title">#${e.id} – ${e.Type}</div>
              <div class="item-detail">${e.Notes || "No description"}</div>
            </div>
          `
            )
            .join("")}
        </div>`
        : `<div class="empty-state">No upcoming events</div>`;

    app.innerHTML = `
      <div class="dashboard-grid">
        <!-- Student Info Card -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">${student.firstName} ${student.lastName}</h2>
            <span class="card-tag">ID ${student.id}</span>
          </div>
          
          <div class="student-info-grid">
            <div class="info-item">
              <div class="info-label">First Name</div>
              <div class="info-value">${student.firstName}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Last Name</div>
              <div class="info-value">${student.lastName}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Parent/Guardian</div>
              <div class="info-value">${
                student.guardianName || "Not assigned"
              }</div>
            </div>
            <div class="info-item">
              <div class="info-label">Student ID</div>
              <div class="info-value">${student.id}</div>
            </div>
          </div>

          <button id="back-btn" style="margin-top: 20px;">Search Another Student</button>
        </div>

        <!-- Attendance History Card -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Attendance History</h2>
            <span class="card-tag">${attendance.length} records</span>
          </div>
          <p class="card-subtitle">Past check-ins and event participation</p>
          ${attendanceHTML}
        </div>

        <!-- Upcoming Events Card -->
        <div class="card" style="grid-column: 1 / -1;">
          <div class="card-header">
            <h2 class="card-title">Upcoming Events</h2>
            <span class="card-tag">${events.length} events</span>
          </div>
          <p class="card-subtitle">All scheduled youth group activities</p>
          ${eventsHTML}
        </div>
      </div>
    `;

    document.getElementById("back-btn").addEventListener("click", renderLookup);
  } catch (err) {
    console.error("Student view error:", err);
    app.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Error Loading Student</h2>
          <span class="card-tag">Error</span>
        </div>
        <div class="status-text status-error">
          Error loading student data: ${err.message}
        </div>
        <p class="card-subtitle" style="margin-top: 16px;">
          This could mean:
        </p>
        <ul style="margin-left: 20px; line-height: 1.8; color: #4a5568;">
          <li>The backend server is not running</li>
          <li>The GraphQL API is not accessible</li>
          <li>There was a database connection issue</li>
        </ul>
        <button id="back-btn" style="margin-top: 20px;">Back to Search</button>
        <button id="retry-btn" class="button-secondary" style="margin-top: 8px;">Retry</button>
      </div>
    `;

    document.getElementById("back-btn").addEventListener("click", renderLookup);
    document.getElementById("retry-btn").addEventListener("click", () => {
      renderStudentDashboard(studentId);
    });
  }
}

// ============================================================
// Initialize
// ============================================================

renderLookup();
