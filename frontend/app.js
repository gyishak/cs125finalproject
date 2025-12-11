const API_BASE = "http://127.0.0.1:8000";
const GRAPHQL_URL = `${API_BASE}/graphql`;

// ============================================================
// Check Authentication
// ============================================================

const currentLeaderId = sessionStorage.getItem("leaderId");
const currentLeaderName = sessionStorage.getItem("leaderName");

if (!currentLeaderId) {
  // Not logged in, redirect to login page
  window.location.href = "leader-login.html";
}

// ============================================================
// Utility Functions
// ============================================================

async function safeFetch(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`Fetch error for ${url}:`, err);
    return null;
  }
}

async function gqlRequest(query, variables = {}) {
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    const json = await res.json();

    if (json.errors) {
      console.error("GraphQL errors:", json.errors);
      throw new Error(json.errors[0].message);
    }

    return json.data;
  } catch (err) {
    console.error("GraphQL request failed:", err);
    throw err;
  }
}

function showStatus(elementId, message, type = "info") {
  const el = document.getElementById(elementId);
  if (!el) return;

  el.className = `status-text status-${type}`;
  el.textContent = message;
  el.style.display = "block";
}

function hideStatus(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.style.display = "none";
}

// ============================================================
// Modal Management
// ============================================================

function openModal(html) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal">${html}</div>`;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal(overlay);
  });

  document.body.appendChild(overlay);
  return overlay;
}

function closeModal(overlay) {
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
}

// ============================================================
// Event Modal
// ============================================================

async function loadMultiDatabaseStats(eventId) {
  const statsEl = document.getElementById("multi-db-stats");

  try {
    // THIS QUERY HITS ALL 3 DATABASES IN ONE REQUEST!
    const query = `
      query MultiDbQuery($eventId: Int!) {
        eventDetails(eventId: $eventId) {
          Type
          Notes
          currentlyCheckedIn
          liveAttendeeCount
          meetingNotes
          notesCount
        }
      }
    `;

    const data = await gqlRequest(query, { eventId });
    const details = data.eventDetails;

    if (!details) {
      statsEl.innerHTML =
        '<p class="empty-state">Could not load event details</p>';
      return;
    }

    statsEl.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
        <div style="text-align: center; padding: 12px; background: rgba(255,255,255,0.6); border-radius: 6px;">
          <div style="font-size: 11px; color: #8b7355; text-transform: uppercase; margin-bottom: 6px; font-weight: 500;">MySQL Data</div>
          <div style="font-size: 20px; font-weight: 600; color: #5a4a3a;">${details.Type}</div>
        </div>
        <div style="text-align: center; padding: 12px; background: rgba(255,255,255,0.6); border-radius: 6px;">
          <div style="font-size: 11px; color: #8b7355; text-transform: uppercase; margin-bottom: 6px; font-weight: 500;">Redis Live</div>
          <div style="font-size: 20px; font-weight: 600; color: #3d5940;">${details.liveAttendeeCount}</div>
          <div style="font-size: 12px; color: #8b7355; margin-top: 4px;">Currently Checked In</div>
        </div>
        <div style="text-align: center; padding: 12px; background: rgba(255,255,255,0.6); border-radius: 6px;">
          <div style="font-size: 11px; color: #8b7355; text-transform: uppercase; margin-bottom: 6px; font-weight: 500;">MongoDB</div>
          <div style="font-size: 20px; font-weight: 600; color: #6d5a45;">${details.notesCount}</div>
          <div style="font-size: 12px; color: #8b7355; margin-top: 4px;">Meeting Notes</div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("Multi-DB stats error:", err);
    statsEl.innerHTML = `<div class="status-text status-error">Error loading stats: ${err.message}</div>`;
  }
}

async function openEventModal(event) {
  const modalHTML = `
    <div class="modal-header">
      <h2 class="modal-title">${event.Type || "Event"}</h2>
      <button class="close-button" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    
    <div class="card-subtitle">${event.Notes || "No description"}</div>

    <!-- MULTI-DATABASE VIEW: Shows data from MySQL + Redis + MongoDB -->
    <div style="margin-top: 20px; padding: 16px; background: rgba(132, 169, 140, 0.1); border-radius: 8px; border: 1px solid rgba(132, 169, 140, 0.3);">
      <h3 class="card-title" style="font-size: 16px; margin-bottom: 14px;">Complete Event Overview</h3>
      <div id="multi-db-stats">
        <div class="spinner" style="width: 24px; height: 24px;"></div>
      </div>
    </div>

    <!-- Event Actions -->
    <div class="button-group">
      <button id="edit-event-btn" class="button-secondary">Edit Event</button>
      <button id="delete-event-btn" class="button-danger">Delete Event</button>
    </div>
    
    <!-- Check-in Section -->
    <div style="margin-top: 24px;">
      <h3 class="card-title">Check In Student</h3>
      <div class="form-group">
        <label class="form-label">Student ID</label>
        <input type="number" id="modal-student-id" placeholder="Enter student ID" />
      </div>
      <button id="checkin-btn">Check In</button>
      <div id="checkin-status" style="display: none;"></div>
    </div>

    <!-- Currently Checked In -->
    <div style="margin-top: 24px;">
      <h3 class="card-title">Currently Checked In <span id="checkin-count" class="card-tag">0</span></h3>
      <div id="checkin-list" class="checkin-list">
        <div class="spinner"></div>
      </div>
      <button id="refresh-checkins-btn" class="button-secondary" style="margin-top: 12px;">Refresh</button>
    </div>

    <!-- Persist Attendance -->
    <div style="margin-top: 24px;">
      <h3 class="card-title">End Event & Save Attendance</h3>
      <p class="card-subtitle">This will save all check-ins to the database and clear live data.</p>
      <button id="persist-btn" class="button-danger">Persist Attendance to MySQL</button>
      <div id="persist-status" style="display: none;"></div>
    </div>

    <!-- Meeting Notes -->
    <div style="margin-top: 24px;">
      <h3 class="card-title">Meeting Notes</h3>
      <div class="form-group">
        <label class="form-label">Add a note</label>
        <textarea id="note-content" placeholder="What happened at this event?"></textarea>
      </div>
      <button id="add-note-btn">Add Note</button>
      <div id="note-status" style="display: none;"></div>
      
      <div id="notes-list" class="notes-list" style="margin-top: 20px;">
        <div class="spinner"></div>
      </div>
    </div>
  `;

  const overlay = openModal(modalHTML);

  // Load MULTI-DATABASE stats first (demonstrates all 3 databases in one query!)
  await loadMultiDatabaseStats(event.id);

  // Load checked-in students
  await loadCheckedInStudents(event.id);

  // Load meeting notes
  await loadMeetingNotes(event.id);

  // Edit event button
  document.getElementById("edit-event-btn").addEventListener("click", () => {
    closeModal(overlay);
    openEditEventModal(event);
  });

  // Delete event button
  document
    .getElementById("delete-event-btn")
    .addEventListener("click", async () => {
      if (
        !confirm(
          `Are you sure you want to delete "${event.Type}"? This will remove all related data.`
        )
      ) {
        return;
      }

      try {
        const mutation = `
        mutation DeleteEvent($eventId: Int!) {
          deleteEvent(eventId: $eventId) {
            success
            message
          }
        }
      `;

        await gqlRequest(mutation, { eventId: event.id });
        alert("Event deleted successfully!");
        closeModal(overlay);
        initDashboard(); // Refresh
      } catch (err) {
        alert(`Error deleting event: ${err.message}`);
      }
    });

  // Set up other event listeners
  document.getElementById("checkin-btn").addEventListener("click", async () => {
    await checkInStudent(event.id);
    // Refresh multi-DB stats after check-in
    await loadMultiDatabaseStats(event.id);
  });

  document
    .getElementById("refresh-checkins-btn")
    .addEventListener("click", async () => {
      await loadCheckedInStudents(event.id);
      await loadMultiDatabaseStats(event.id);
    });

  document.getElementById("persist-btn").addEventListener("click", () => {
    persistAttendance(event.id);
  });

  document
    .getElementById("add-note-btn")
    .addEventListener("click", async () => {
      await addMeetingNote(event.id);
      // Refresh multi-DB stats after adding note
      await loadMultiDatabaseStats(event.id);
    });
}

async function loadCheckedInStudents(eventId) {
  const listEl = document.getElementById("checkin-list");
  const countEl = document.getElementById("checkin-count");

  try {
    const query = `
      query CheckedIn($eventId: Int!) {
        checkedInStudents(eventId: $eventId)
        students {
          id
          firstName
          lastName
        }
      }
    `;

    const data = await gqlRequest(query, { eventId });
    const checkedInIds = data.checkedInStudents || [];
    const allStudents = data.students || [];

    countEl.textContent = checkedInIds.length;

    if (checkedInIds.length === 0) {
      listEl.innerHTML =
        '<div class="empty-state">No students checked in yet</div>';
      return;
    }

    // Map IDs to student names
    const checkedInStudents = checkedInIds.map((id) => {
      const student = allStudents.find((s) => s.id === parseInt(id));
      return student
        ? `${student.firstName} ${student.lastName}`
        : `Student #${id}`;
    });

    listEl.innerHTML = checkedInStudents
      .map((name) => `<div class="checkin-badge">${name}</div>`)
      .join("");
  } catch (err) {
    listEl.innerHTML = `<div class="status-text status-error">Error loading check-ins: ${err.message}</div>`;
  }
}

async function checkInStudent(eventId) {
  const studentIdInput = document.getElementById("modal-student-id");
  const studentId = parseInt(studentIdInput.value);

  if (!studentId) {
    showStatus("checkin-status", "Please enter a student ID", "error");
    return;
  }

  try {
    const mutation = `
      mutation CheckIn($eventId: Int!, $studentId: Int!) {
        checkIn(eventId: $eventId, studentId: $studentId) {
          status
        }
      }
    `;

    await gqlRequest(mutation, { eventId, studentId });

    showStatus(
      "checkin-status",
      `Student ${studentId} checked in successfully!`,
      "success"
    );
    studentIdInput.value = "";

    // Refresh the list
    await loadCheckedInStudents(eventId);

    setTimeout(() => hideStatus("checkin-status"), 3000);
  } catch (err) {
    showStatus("checkin-status", `Error: ${err.message}`, "error");
  }
}

async function persistAttendance(eventId) {
  if (
    !confirm(
      "This will save all check-ins to the database and clear live data. Continue?"
    )
  ) {
    return;
  }

  try {
    const mutation = `
      mutation Persist($eventId: Int!) {
        persistAttendance(eventId: $eventId) {
          count
        }
      }
    `;

    const data = await gqlRequest(mutation, { eventId });

    showStatus(
      "persist-status",
      `Successfully saved ${data.persistAttendance.count} attendance records!`,
      "success"
    );

    // Refresh check-in list (should be empty now)
    await loadCheckedInStudents(eventId);
  } catch (err) {
    showStatus("persist-status", `Error: ${err.message}`, "error");
  }
}

async function loadMeetingNotes(eventId) {
  const listEl = document.getElementById("notes-list");

  try {
    const query = `
      query Notes($eventId: Int!) {
        meetingNotes(eventId: $eventId) {
          id
          content
          createdAt
        }
      }
    `;

    const data = await gqlRequest(query, { eventId });
    const notes = data.meetingNotes || [];

    if (notes.length === 0) {
      listEl.innerHTML =
        '<div class="empty-state">No notes yet for this event</div>';
      return;
    }

    listEl.innerHTML = notes
      .map((note) => {
        const date = new Date(note.createdAt).toLocaleString();
        return `
        <div class="note-item">
          <div class="note-meta">
            <span class="note-author">Leader</span>
            <span>${date}</span>
          </div>
          <div class="note-content">${note.content}</div>
        </div>
      `;
      })
      .join("");
  } catch (err) {
    listEl.innerHTML = `<div class="status-text status-error">Error loading notes: ${err.message}</div>`;
  }
}

async function addMeetingNote(eventId) {
  const contentEl = document.getElementById("note-content");
  const content = contentEl.value.trim();

  if (!content) {
    showStatus("note-status", "Please enter a note", "error");
    return;
  }

  try {
    const mutation = `
      mutation AddNote($eventId: Int!, $content: String!) {
        addMeetingNote(eventId: $eventId, content: $content) {
          id
        }
      }
    `;

    await gqlRequest(mutation, { eventId, content });

    showStatus("note-status", "Note added successfully!", "success");
    contentEl.value = "";

    // Refresh notes list
    await loadMeetingNotes(eventId);

    setTimeout(() => hideStatus("note-status"), 3000);
  } catch (err) {
    showStatus("note-status", `Error: ${err.message}`, "error");
  }
}

// ============================================================
// Student Modal
// ============================================================

async function openStudentModal(student) {
  const modalHTML = `
    <div class="modal-header">
      <h2 class="modal-title">${student.firstName} ${student.lastName}</h2>
      <button class="close-button" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    
    <div class="student-info-grid">
      <div class="info-item">
        <div class="info-label">Student ID</div>
        <div class="info-value">${student.id}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Parent/Guardian</div>
        <div class="info-value">${student.guardianName || "Not assigned"}</div>
      </div>
    </div>

    <div style="margin-top: 24px;">
      <h3 class="card-title">Attendance History</h3>
      <div id="student-attendance">
        <div class="spinner"></div>
      </div>
    </div>

    <div class="button-group">
      <button id="edit-student-btn" class="button-secondary">Edit Student</button>
      <button id="delete-student-btn" class="button-danger">Delete Student</button>
    </div>
  `;

  const overlay = openModal(modalHTML);

  // Load attendance history
  await loadStudentAttendance(student.id);

  // Edit button
  document.getElementById("edit-student-btn").addEventListener("click", () => {
    closeModal(overlay);
    openEditStudentModal(student);
  });

  // Delete button
  document
    .getElementById("delete-student-btn")
    .addEventListener("click", async () => {
      if (
        !confirm(
          `Are you sure you want to delete ${student.firstName} ${student.lastName}?`
        )
      ) {
        return;
      }

      try {
        const mutation = `
        mutation DeleteStudent($studentId: Int!) {
          deleteStudent(studentId: $studentId) {
            success
            message
          }
        }
      `;

        await gqlRequest(mutation, { studentId: student.id });
        alert("Student deleted successfully!");
        closeModal(overlay);
        initDashboard(); // Refresh
      } catch (err) {
        alert(`Error deleting student: ${err.message}`);
      }
    });
}

async function loadStudentAttendance(studentId) {
  const listEl = document.getElementById("student-attendance");

  try {
    const query = `
      query StudentAttendance($studentId: Int!) {
        studentAttendance(studentId: $studentId) {
          id
          eventId
          theDATE
          theTime
          eventName
        }
      }
    `;

    const data = await gqlRequest(query, { studentId });
    const attendance = data.studentAttendance || [];

    if (attendance.length === 0) {
      listEl.innerHTML =
        '<div class="empty-state">No attendance records found</div>';
      return;
    }

    listEl.innerHTML = attendance
      .map(
        (a) => `
      <div class="attendance-item">
        <div>
          <div class="attendance-date">${a.theDATE} at ${a.theTime}</div>
          <div class="attendance-event">${
            a.eventName || `Event #${a.eventId}`
          }</div>
        </div>
        <div class="card-tag">Present</div>
      </div>
    `
      )
      .join("");
  } catch (err) {
    listEl.innerHTML = `<div class="status-text status-error">Error loading attendance: ${err.message}</div>`;
  }
}

// ============================================================
// Main Dashboard
// ============================================================

async function initDashboard() {
  // Update welcome message
  const welcomeMsg = document.getElementById("welcome-message");
  if (welcomeMsg && currentLeaderName) {
    welcomeMsg.textContent = `Welcome back, ${currentLeaderName}!`;
  }

  // Setup logout button
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("leaderId");
      sessionStorage.removeItem("leaderName");
      window.location.href = "leader-login.html";
    });
  }

  const root = document.getElementById("app");

  // Load events + students
  const events = (await safeFetch(`${API_BASE}/events`)) || [];
  const students = (await safeFetch(`${API_BASE}/students`)) || [];

  if (events.length === 0 && students.length === 0) {
    root.innerHTML = `
      <div class="card">
        <div class="status-text status-error">
          Could not load data from the API. Make sure your backend is running at ${API_BASE}
        </div>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="dashboard-grid">
      <!-- EVENTS -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Events</h2>
          <span class="card-tag">${events.length} total</span>
        </div>
        <p class="card-subtitle">Click an event to manage, or create a new one</p>
        <button id="create-event-btn" style="margin-bottom: 12px; width: 100%;">+ Create New Event</button>
        <div class="item-list" id="events-list"></div>
      </div>

      <!-- STUDENTS -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Students</h2>
          <span class="card-tag">${students.length} total</span>
        </div>
        <p class="card-subtitle">Click a student to view details, or add a new one</p>
        <button id="create-student-btn" style="margin-bottom: 12px; width: 100%;">+ Add New Student</button>
        <div class="item-list" id="students-list"></div>
      </div>
    </div>
  `;

  // Render events
  const eventsListEl = document.getElementById("events-list");
  if (events.length === 0) {
    eventsListEl.innerHTML = '<div class="empty-state">No events found</div>';
  } else {
    eventsListEl.innerHTML = events
      .map(
        (ev) => `
      <div class="item" data-event-id="${ev.id}">
        <div class="item-title">${ev.Type || "Untitled Event"}</div>
        <div class="item-detail">${ev.Notes || "No description"}</div>
      </div>
    `
      )
      .join("");

    // Add click handlers
    document.querySelectorAll(".item[data-event-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const eventId = parseInt(el.dataset.eventId);
        const event = events.find((e) => e.id === eventId);
        if (event) openEventModal(event);
      });
    });
  }

  // Create event button
  document
    .getElementById("create-event-btn")
    .addEventListener("click", openCreateEventModal);

  // Render students
  const studentsListEl = document.getElementById("students-list");
  if (students.length === 0) {
    studentsListEl.innerHTML =
      '<div class="empty-state">No students found</div>';
  } else {
    studentsListEl.innerHTML = students
      .map(
        (s) => `
      <div class="item" data-student-id="${s.id}">
        <div class="item-title">${s.firstName} ${s.lastName}</div>
        <div class="item-detail">Guardian: ${
          s.guardianName || "Not assigned"
        }</div>
      </div>
    `
      )
      .join("");

    // Add click handlers
    document.querySelectorAll(".item[data-student-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const studentId = parseInt(el.dataset.studentId);
        const student = students.find((s) => s.id === studentId);
        if (student) openStudentModal(student);
      });
    });
  }

  // Create student button
  document
    .getElementById("create-student-btn")
    .addEventListener("click", openCreateStudentModal);
}

// Initialize on load
initDashboard();

// ============================================================
// CREATE Modals
// ============================================================

function openCreateStudentModal() {
  const modalHTML = `
    <div class="modal-header">
      <h2 class="modal-title">Add New Student</h2>
      <button class="close-button" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    
    <form id="create-student-form">
      <div class="form-group">
        <label class="form-label">First Name</label>
        <input type="text" id="student-firstname" required />
      </div>
      <div class="form-group">
        <label class="form-label">Last Name</label>
        <input type="text" id="student-lastname" required />
      </div>
      <div class="form-group">
        <label class="form-label">Guardian ID (optional)</label>
        <input type="number" id="student-guardian" />
      </div>
      <button type="submit">Create Student</button>
      <div id="create-student-status" style="display: none;"></div>
    </form>
  `;

  const overlay = openModal(modalHTML);

  document
    .getElementById("create-student-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const firstName = document
        .getElementById("student-firstname")
        .value.trim();
      const lastName = document.getElementById("student-lastname").value.trim();
      const guardianID =
        document.getElementById("student-guardian").value || null;

      try {
        const mutation = `
        mutation CreateStudent($firstName: String!, $lastName: String!, $guardianID: Int) {
          createStudent(firstName: $firstName, lastName: $lastName, guardianID: $guardianID) {
            id
            firstName
            lastName
          }
        }
      `;

        const data = await gqlRequest(mutation, {
          firstName,
          lastName,
          guardianID: guardianID ? parseInt(guardianID) : null,
        });

        showStatus(
          "create-student-status",
          `Student ${data.createStudent.firstName} ${data.createStudent.lastName} created!`,
          "success"
        );

        setTimeout(() => {
          closeModal(overlay);
          initDashboard();
        }, 1500);
      } catch (err) {
        showStatus("create-student-status", `Error: ${err.message}`, "error");
      }
    });
}

function openCreateEventModal() {
  const modalHTML = `
    <div class="modal-header">
      <h2 class="modal-title">Create New Event</h2>
      <button class="close-button" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    
    <form id="create-event-form">
      <div class="form-group">
        <label class="form-label">Event Name</label>
        <input type="text" id="event-type" required />
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea id="event-notes" required></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Event Type ID</label>
        <input type="number" id="event-typeid" value="1" required />
        <p style="font-size: 12px; color: #8b7355; margin-top: 4px;">1=Youth Group, 2=Service, 3=Retreat, 4=Bible Study, 5=Worship</p>
      </div>
      <button type="submit">Create Event</button>
      <div id="create-event-status" style="display: none;"></div>
    </form>
  `;

  const overlay = openModal(modalHTML);

  document
    .getElementById("create-event-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const Type = document.getElementById("event-type").value.trim();
      const Notes = document.getElementById("event-notes").value.trim();
      const eventTypeId = parseInt(
        document.getElementById("event-typeid").value
      );

      try {
        const mutation = `
        mutation CreateEvent($Type: String!, $Notes: String!, $eventTypeId: Int!) {
          createEvent(Type: $Type, Notes: $Notes, eventTypeId: $eventTypeId) {
            id
            Type
            Notes
          }
        }
      `;

        const data = await gqlRequest(mutation, { Type, Notes, eventTypeId });

        showStatus(
          "create-event-status",
          `Event "${data.createEvent.Type}" created!`,
          "success"
        );

        setTimeout(() => {
          closeModal(overlay);
          initDashboard();
        }, 1500);
      } catch (err) {
        showStatus("create-event-status", `Error: ${err.message}`, "error");
      }
    });
}

// ============================================================
// EDIT Modals
// ============================================================

function openEditStudentModal(student) {
  const modalHTML = `
    <div class="modal-header">
      <h2 class="modal-title">Edit Student</h2>
      <button class="close-button" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    
    <form id="edit-student-form">
      <div class="form-group">
        <label class="form-label">First Name</label>
        <input type="text" id="edit-firstname" value="${
          student.firstName
        }" required />
      </div>
      <div class="form-group">
        <label class="form-label">Last Name</label>
        <input type="text" id="edit-lastname" value="${
          student.lastName
        }" required />
      </div>
      <div class="form-group">
        <label class="form-label">Guardian ID</label>
        <input type="number" id="edit-guardian" value="${
          student.guardianID || ""
        }" />
      </div>
      <button type="submit">Save Changes</button>
      <div id="edit-student-status" style="display: none;"></div>
    </form>
  `;

  const overlay = openModal(modalHTML);

  document
    .getElementById("edit-student-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const firstName = document.getElementById("edit-firstname").value.trim();
      const lastName = document.getElementById("edit-lastname").value.trim();
      const guardianID = document.getElementById("edit-guardian").value || null;

      try {
        const mutation = `
        mutation UpdateStudent($studentId: Int!, $firstName: String, $lastName: String, $guardianID: Int) {
          updateStudent(studentId: $studentId, firstName: $firstName, lastName: $lastName, guardianID: $guardianID) {
            id
            firstName
            lastName
          }
        }
      `;

        await gqlRequest(mutation, {
          studentId: student.id,
          firstName,
          lastName,
          guardianID: guardianID ? parseInt(guardianID) : null,
        });

        showStatus(
          "edit-student-status",
          "Student updated successfully!",
          "success"
        );

        setTimeout(() => {
          closeModal(overlay);
          initDashboard();
        }, 1500);
      } catch (err) {
        showStatus("edit-student-status", `Error: ${err.message}`, "error");
      }
    });
}

function openEditEventModal(event) {
  const modalHTML = `
    <div class="modal-header">
      <h2 class="modal-title">Edit Event</h2>
      <button class="close-button" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    
    <form id="edit-event-form">
      <div class="form-group">
        <label class="form-label">Event Name</label>
        <input type="text" id="edit-type" value="${event.Type}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea id="edit-notes" required>${event.Notes}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Event Type ID</label>
        <input type="number" id="edit-typeid" value="${
          event.eventTypeid || 1
        }" required />
      </div>
      <button type="submit">Save Changes</button>
      <div id="edit-event-status" style="display: none;"></div>
    </form>
  `;

  const overlay = openModal(modalHTML);

  document
    .getElementById("edit-event-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const Type = document.getElementById("edit-type").value.trim();
      const Notes = document.getElementById("edit-notes").value.trim();
      const eventTypeId = parseInt(
        document.getElementById("edit-typeid").value
      );

      try {
        const mutation = `
        mutation UpdateEvent($eventId: Int!, $Type: String, $Notes: String, $eventTypeId: Int) {
          updateEvent(eventId: $eventId, Type: $Type, Notes: $Notes, eventTypeId: $eventTypeId) {
            id
            Type
            Notes
          }
        }
      `;

        await gqlRequest(mutation, {
          eventId: event.id,
          Type,
          Notes,
          eventTypeId,
        });

        showStatus(
          "edit-event-status",
          "Event updated successfully!",
          "success"
        );

        setTimeout(() => {
          closeModal(overlay);
          initDashboard();
        }, 1500);
      } catch (err) {
        showStatus("edit-event-status", `Error: ${err.message}`, "error");
      }
    });
}
