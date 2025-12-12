const API_BASE = "http://localhost:8000";
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

  // Load events + students + groups
  const events = (await safeFetch(`${API_BASE}/events`)) || [];
  const students = (await safeFetch(`${API_BASE}/students`)) || [];

  // Load groups via GraphQL
  let groups = [];
  try {
    const query = `
      query GetAllGroups {
        groups {
          id
          name
          memberCount
          members {
            id
            firstName
            lastName
          }
          leaders {
            id
            firstName
            lastName
          }
        }
      }
    `;
    const data = await gqlRequest(query);
    groups = data.groups || [];
  } catch (err) {
    console.error("Error loading groups:", err);
  }

  // Load volunteers via GraphQL
  let volunteers = [];
  try {
    const query = `
      query GetAllVolunteers {
        volunteers {
          id
          firstName
          lastName
        }
      }
    `;
    const data = await gqlRequest(query);
    volunteers = data.volunteers || [];
  } catch (err) {
    console.error("Error loading volunteers:", err);
  }

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

      <!-- SMALL GROUPS -->
      <div class="card" style="grid-column: 1 / -1;">
        <div class="card-header">
          <h2 class="card-title">Small Groups</h2>
          <span class="card-tag">${groups.length} groups</span>
        </div>
        <p class="card-subtitle">Manage small groups and their members</p>
        <button id="create-group-btn" style="margin-bottom: 12px; width: 100%;">+ Create New Group</button>
        <div id="groups-list"></div>
      </div>

      <!-- VOLUNTEERS -->
      <div class="card" style="grid-column: 1 / -1;">
        <div class="card-header">
          <h2 class="card-title">Volunteers</h2>
          <span class="card-tag">${volunteers.length} total</span>
        </div>
        <p class="card-subtitle">Manage volunteers and track their service</p>
        <button id="create-volunteer-btn" style="margin-bottom: 12px; width: 100%;">+ Add New Volunteer</button>
        <div class="item-list" id="volunteers-list"></div>
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

  // Render groups
  const groupsListEl = document.getElementById("groups-list");
  if (groups.length === 0) {
    groupsListEl.innerHTML =
      '<div class="empty-state">No groups found. Create your first small group!</div>';
  } else {
    groupsListEl.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
        ${groups
          .map(
            (g) => `
          <div class="item" data-group-id="${g.id}" style="cursor: pointer;">
            <div class="item-title">${g.name}</div>
            <div class="item-detail">
              ${g.memberCount} member${g.memberCount !== 1 ? "s" : ""} • 
              ${g.leaders.length} leader${g.leaders.length !== 1 ? "s" : ""}
            </div>
            <div style="margin-top: 8px; font-size: 12px; color: #8b7355;">
              ${
                g.leaders.length > 0
                  ? `Led by: ${g.leaders
                      .map((l) => `${l.firstName} ${l.lastName}`)
                      .join(", ")}`
                  : "No leaders assigned"
              }
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;

    // Add click handlers
    document.querySelectorAll(".item[data-group-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const groupId = parseInt(el.dataset.groupId);
        const group = groups.find((g) => g.id === groupId);
        if (group) openGroupModal(group, students);
      });
    });
  }

  // Create group button
  document
    .getElementById("create-group-btn")
    .addEventListener("click", openCreateGroupModal);

  // Render volunteers
  const volunteersListEl = document.getElementById("volunteers-list");
  if (volunteers.length === 0) {
    volunteersListEl.innerHTML =
      '<div class="empty-state">No volunteers found. Add your first volunteer!</div>';
  } else {
    volunteersListEl.innerHTML = volunteers
      .map(
        (v) => `
      <div class="item" data-volunteer-id="${v.id}" style="cursor: pointer;">
        <div class="item-title">${v.firstName} ${v.lastName}</div>
        <div class="item-detail">Volunteer ID: ${v.id}</div>
      </div>
    `
      )
      .join("");

    // Add click handlers
    document.querySelectorAll(".item[data-volunteer-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const volunteerId = parseInt(el.dataset.volunteerId);
        const volunteer = volunteers.find((v) => v.id === volunteerId);
        if (volunteer) openVolunteerModal(volunteer, events);
      });
    });
  }

  // Create volunteer button
  document
    .getElementById("create-volunteer-btn")
    .addEventListener("click", openCreateVolunteerModal);
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

// ============================================================
// SMALL GROUPS MODALS
// ============================================================

function openCreateGroupModal() {
  const modalHTML = `
    <div class="modal-header">
      <h2 class="modal-title">Create New Group</h2>
      <button class="close-button" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    
    <form id="create-group-form">
      <div class="form-group">
        <label class="form-label">Group Name</label>
        <input type="text" id="group-name" placeholder="e.g., Middle School Girls" required />
      </div>
      <button type="submit">Create Group</button>
      <div id="create-group-status" style="display: none;"></div>
    </form>
  `;

  const overlay = openModal(modalHTML);

  document
    .getElementById("create-group-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("group-name").value.trim();

      if (!name) {
        showStatus("create-group-status", "Group name is required", "error");
        return;
      }

      try {
        const mutation = `
          mutation CreateGroup($name: String!) {
            createGroup(name: $name) {
              id
              name
            }
          }
        `;

        await gqlRequest(mutation, { name });

        showStatus(
          "create-group-status",
          "Group created successfully!",
          "success"
        );

        setTimeout(() => {
          closeModal(overlay);
          initDashboard();
        }, 1500);
      } catch (err) {
        showStatus("create-group-status", `Error: ${err.message}`, "error");
      }
    });
}

async function openGroupModal(group, allStudents) {
  const memberIds = group.members.map((m) => m.id);
  const availableStudents = allStudents.filter(
    (s) => !memberIds.includes(s.id)
  );

  // Fetch all leaders to allow assignment
  let allLeaders = [];
  try {
    const query = `
      query {
        leaders {
          id
          firstName
          lastName
        }
      }
    `;

    // We need to add this query to GraphQL first, but let's use what we have
    // For now, we'll hardcode the leaders from your data
    allLeaders = [
      { id: 1, firstName: "Sarah", lastName: "Brown" },
      { id: 2, firstName: "Michael", lastName: "Davis" },
      { id: 3, firstName: "Laura", lastName: "Green" },
      { id: 4, firstName: "Daniel", lastName: "White" },
      { id: 5, firstName: "Rachel", lastName: "Thompson" },
    ];
  } catch (err) {
    console.error("Error loading leaders:", err);
  }

  const leaderIds = group.leaders.map((l) => l.id);
  const availableLeaders = allLeaders.filter((l) => !leaderIds.includes(l.id));

  const modalHTML = `
    <div class="modal-header">
      <h2 class="modal-title">${group.name}</h2>
      <button class="close-button" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>

    <div class="modal-section">
      <h3 style="margin-bottom: 12px; font-size: 16px; font-weight: 600;">Leaders (${
        group.leaders.length
      })</h3>
      ${
        group.leaders.length > 0
          ? `<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
              ${group.leaders
                .map(
                  (l) => `
                <div class="checkin-badge">
                  ${l.firstName} ${l.lastName}
                  <button onclick="removeLeaderFromGroup(${group.id}, ${l.id})" 
                          style="margin-left: 6px; background: none; border: none; cursor: pointer; color: inherit; padding: 0;">×</button>
                </div>
              `
                )
                .join("")}
            </div>`
          : '<p style="color: #8b7355; font-size: 14px; margin-bottom: 16px;">No leaders assigned</p>'
      }
      ${
        availableLeaders.length > 0
          ? `
        <div class="form-group" style="margin-top: 12px;">
          <label class="form-label">Add Leader</label>
          <select id="leader-to-add" style="width: 100%; padding: 10px; border: 1px solid rgba(139, 115, 85, 0.2); border-radius: 7px;">
            <option value="">Select a leader...</option>
            ${availableLeaders
              .map(
                (l) =>
                  `<option value="${l.id}">${l.firstName} ${l.lastName}</option>`
              )
              .join("")}
          </select>
        </div>
        <button onclick="addLeaderToGroup(${
          group.id
        })" style="width: 100%; margin-top: 8px;">Add Leader</button>
        <div id="add-leader-status" style="display: none; margin-top: 12px;"></div>
      `
          : ""
      }
    </div>

    <div class="modal-section">
      <h3 style="margin-bottom: 12px; font-size: 16px; font-weight: 600;">Members (${
        group.members.length
      })</h3>
      ${
        group.members.length > 0
          ? `<div class="item-list" style="max-height: 200px;">
              ${group.members
                .map(
                  (m) => `
                <div class="item" style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div class="item-title">${m.firstName} ${m.lastName}</div>
                    <div class="item-detail">Student ID: ${m.id}</div>
                  </div>
                  <button onclick="removeStudentFromGroup(${group.id}, ${m.id})" 
                          class="button-danger" style="padding: 6px 12px;">Remove</button>
                </div>
              `
                )
                .join("")}
            </div>`
          : '<p style="color: #8b7355; font-size: 14px;">No members yet</p>'
      }
    </div>

    ${
      availableStudents.length > 0
        ? `
      <div class="modal-section">
        <h3 style="margin-bottom: 12px; font-size: 16px; font-weight: 600;">Add Members</h3>
        <div class="form-group">
          <select id="student-to-add" style="width: 100%; padding: 10px; border: 1px solid rgba(139, 115, 85, 0.2); border-radius: 7px;">
            <option value="">Select a student...</option>
            ${availableStudents
              .map(
                (s) =>
                  `<option value="${s.id}">${s.firstName} ${s.lastName}</option>`
              )
              .join("")}
          </select>
        </div>
        <button onclick="addStudentToGroup(${
          group.id
        })" style="width: 100%;">Add Student</button>
        <div id="add-member-status" style="display: none; margin-top: 12px;"></div>
      </div>
    `
        : ""
    }

    <div class="modal-section">
      <div class="button-group">
        <button onclick="openEditGroupModal(${group.id}, '${group.name.replace(
    /'/g,
    "\\'"
  )}')">Rename Group</button>
        <button onclick="deleteGroup(${
          group.id
        })" class="button-danger">Delete Group</button>
      </div>
    </div>
  `;

  openModal(modalHTML);
}

async function addStudentToGroup(groupId) {
  const selectEl = document.getElementById("student-to-add");
  const studentId = parseInt(selectEl.value);

  if (!studentId) {
    showStatus("add-member-status", "Please select a student", "error");
    return;
  }

  try {
    const mutation = `
      mutation AddStudentToGroup($groupId: Int!, $studentId: Int!) {
        addStudentToGroup(groupId: $groupId, studentId: $studentId) {
          success
          message
        }
      }
    `;

    const data = await gqlRequest(mutation, { groupId, studentId });

    if (data.addStudentToGroup.success) {
      showStatus("add-member-status", "Student added successfully!", "success");
      setTimeout(() => {
        document.querySelector(".modal-overlay").remove();
        initDashboard();
      }, 1000);
    } else {
      showStatus("add-member-status", data.addStudentToGroup.message, "error");
    }
  } catch (err) {
    showStatus("add-member-status", `Error: ${err.message}`, "error");
  }
}

async function addLeaderToGroup(groupId) {
  const selectEl = document.getElementById("leader-to-add");
  const leaderId = parseInt(selectEl.value);

  if (!leaderId) {
    showStatus("add-leader-status", "Please select a leader", "error");
    return;
  }

  try {
    const mutation = `
      mutation AddLeaderToGroup($groupId: Int!, $leaderId: Int!) {
        addLeaderToGroup(groupId: $groupId, leaderId: $leaderId) {
          success
          message
        }
      }
    `;

    const data = await gqlRequest(mutation, { groupId, leaderId });

    if (data.addLeaderToGroup.success) {
      showStatus("add-leader-status", "Leader added successfully!", "success");
      setTimeout(() => {
        document.querySelector(".modal-overlay").remove();
        initDashboard();
      }, 1000);
    } else {
      showStatus("add-leader-status", data.addLeaderToGroup.message, "error");
    }
  } catch (err) {
    showStatus("add-leader-status", `Error: ${err.message}`, "error");
  }
}

async function removeStudentFromGroup(groupId, studentId) {
  if (!confirm("Remove this student from the group?")) return;

  try {
    const mutation = `
      mutation RemoveStudentFromGroup($groupId: Int!, $studentId: Int!) {
        removeStudentFromGroup(groupId: $groupId, studentId: $studentId) {
          success
          message
        }
      }
    `;

    await gqlRequest(mutation, { groupId, studentId });

    document.querySelector(".modal-overlay").remove();
    initDashboard();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function removeLeaderFromGroup(groupId, leaderId) {
  if (!confirm("Remove this leader from the group?")) return;

  try {
    const mutation = `
      mutation RemoveLeaderFromGroup($groupId: Int!, $leaderId: Int!) {
        removeLeaderFromGroup(groupId: $groupId, leaderId: $leaderId) {
          success
          message
        }
      }
    `;

    await gqlRequest(mutation, { groupId, leaderId });

    document.querySelector(".modal-overlay").remove();
    initDashboard();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

function openEditGroupModal(groupId, currentName) {
  const modalHTML = `
    <div class="modal-header">
      <h2 class="modal-title">Rename Group</h2>
      <button class="close-button" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    
    <form id="edit-group-form">
      <div class="form-group">
        <label class="form-label">Group Name</label>
        <input type="text" id="edit-group-name" value="${currentName}" required />
      </div>
      <button type="submit">Save Changes</button>
      <div id="edit-group-status" style="display: none;"></div>
    </form>
  `;

  const overlay = openModal(modalHTML);

  document
    .getElementById("edit-group-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("edit-group-name").value.trim();

      try {
        const mutation = `
          mutation UpdateGroup($groupId: Int!, $name: String!) {
            updateGroup(groupId: $groupId, name: $name) {
              id
              name
            }
          }
        `;

        await gqlRequest(mutation, { groupId, name });

        showStatus(
          "edit-group-status",
          "Group updated successfully!",
          "success"
        );

        setTimeout(() => {
          closeModal(overlay);
          initDashboard();
        }, 1500);
      } catch (err) {
        showStatus("edit-group-status", `Error: ${err.message}`, "error");
      }
    });
}

async function deleteGroup(groupId) {
  if (
    !confirm(
      "Are you sure you want to delete this group? This will remove all members but will not delete the students themselves."
    )
  ) {
    return;
  }

  try {
    const mutation = `
      mutation DeleteGroup($groupId: Int!) {
        deleteGroup(groupId: $groupId) {
          success
          message
        }
      }
    `;

    const data = await gqlRequest(mutation, { groupId });

    if (data.deleteGroup.success) {
      document.querySelector(".modal-overlay").remove();
      initDashboard();
    } else {
      alert(data.deleteGroup.message);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ============================================================
// VOLUNTEERS MODALS
// ============================================================

function openCreateVolunteerModal() {
  const modalHTML = `
    <div class="modal-header">
      <h2 class="modal-title">Add New Volunteer</h2>
      <button class="close-button" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    
    <form id="create-volunteer-form">
      <div class="form-group">
        <label class="form-label">First Name</label>
        <input type="text" id="volunteer-firstname" placeholder="First name" required />
      </div>
      <div class="form-group">
        <label class="form-label">Last Name</label>
        <input type="text" id="volunteer-lastname" placeholder="Last name" required />
      </div>
      <button type="submit">Add Volunteer</button>
      <div id="create-volunteer-status" style="display: none;"></div>
    </form>
  `;

  const overlay = openModal(modalHTML);

  document
    .getElementById("create-volunteer-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const firstName = document
        .getElementById("volunteer-firstname")
        .value.trim();
      const lastName = document
        .getElementById("volunteer-lastname")
        .value.trim();

      if (!firstName || !lastName) {
        showStatus(
          "create-volunteer-status",
          "Both names are required",
          "error"
        );
        return;
      }

      try {
        const mutation = `
          mutation CreateVolunteer($firstName: String!, $lastName: String!) {
            createVolunteer(firstName: $firstName, lastName: $lastName) {
              id
              firstName
              lastName
            }
          }
        `;

        await gqlRequest(mutation, { firstName, lastName });

        showStatus(
          "create-volunteer-status",
          "Volunteer added successfully!",
          "success"
        );

        setTimeout(() => {
          closeModal(overlay);
          initDashboard();
        }, 1500);
      } catch (err) {
        showStatus("create-volunteer-status", `Error: ${err.message}`, "error");
      }
    });
}

async function openVolunteerModal(volunteer, allEvents) {
  const modalHTML = `
    <div class="modal-header">
      <h2 class="modal-title">${volunteer.firstName} ${volunteer.lastName}</h2>
      <button class="close-button" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>

    <div class="modal-section">
      <h3 style="margin-bottom: 12px; font-size: 16px; font-weight: 600;">Volunteer Information</h3>
      <div class="info-item">
        <div class="info-label">Name</div>
        <div class="info-value">${volunteer.firstName} ${
    volunteer.lastName
  }</div>
      </div>
      <div class="info-item">
        <div class="info-label">Volunteer ID</div>
        <div class="info-value">${volunteer.id}</div>
      </div>
    </div>

    <div class="modal-section">
      <h3 style="margin-bottom: 12px; font-size: 16px; font-weight: 600;">Service History</h3>
      <div id="volunteer-records-list">Loading...</div>
    </div>

    ${
      allEvents.length > 0
        ? `
      <div class="modal-section">
        <h3 style="margin-bottom: 12px; font-size: 16px; font-weight: 600;">Assign to Event</h3>
        <div class="form-group">
          <select id="event-to-assign" style="width: 100%; padding: 10px; border: 1px solid rgba(139, 115, 85, 0.2); border-radius: 7px;">
            <option value="">Select an event...</option>
            ${allEvents
              .map((e) => `<option value="${e.id}">${e.Type}</option>`)
              .join("")}
          </select>
        </div>
        <button onclick="assignVolunteerToEvent(${
          volunteer.id
        })" style="width: 100%;">Assign to Event</button>
        <div id="assign-event-status" style="display: none; margin-top: 12px;"></div>
      </div>
    `
        : ""
    }

    <div class="modal-section">
      <div class="button-group">
        <button onclick="openEditVolunteerModal(${
          volunteer.id
        }, '${volunteer.firstName.replace(
    /'/g,
    "\\'"
  )}', '${volunteer.lastName.replace(/'/g, "\\'")}')">Edit Volunteer</button>
        <button onclick="deleteVolunteer(${
          volunteer.id
        })" class="button-danger">Delete Volunteer</button>
      </div>
    </div>
  `;

  openModal(modalHTML);

  // Load volunteer records
  try {
    const query = `
      query GetVolunteerRecords($volunteerId: Int!) {
        volunteerRecords(volunteerId: $volunteerId) {
          id
          eventId
          eventName
        }
      }
    `;

    const data = await gqlRequest(query, { volunteerId: volunteer.id });
    const records = data.volunteerRecords || [];

    const recordsEl = document.getElementById("volunteer-records-list");
    if (records.length === 0) {
      recordsEl.innerHTML =
        '<p style="color: #8b7355; font-size: 14px;">No service history yet</p>';
    } else {
      recordsEl.innerHTML = records
        .map(
          (r) => `
        <div class="item" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div class="item-title">${
              r.eventName || `Event #${r.eventId}`
            }</div>
            <div class="item-detail">Record ID: ${r.id}</div>
          </div>
          <button onclick="removeVolunteerFromEvent(${volunteer.id}, ${
            r.eventId
          })" 
                  class="button-danger" style="padding: 6px 12px;">Remove</button>
        </div>
      `
        )
        .join("");
    }
  } catch (err) {
    console.error("Error loading volunteer records:", err);
    document.getElementById("volunteer-records-list").innerHTML =
      '<p style="color: #b85c4f;">Error loading records</p>';
  }
}

async function assignVolunteerToEvent(volunteerId) {
  const selectEl = document.getElementById("event-to-assign");
  const eventId = parseInt(selectEl.value);

  if (!eventId) {
    showStatus("assign-event-status", "Please select an event", "error");
    return;
  }

  try {
    const mutation = `
      mutation AssignVolunteer($volunteerId: Int!, $eventId: Int!) {
        addVolunteerToEvent(volunteerId: $volunteerId, eventId: $eventId) {
          success
          message
        }
      }
    `;

    const data = await gqlRequest(mutation, { volunteerId, eventId });

    if (data.addVolunteerToEvent.success) {
      showStatus(
        "assign-event-status",
        "Volunteer assigned successfully!",
        "success"
      );
      setTimeout(() => {
        document.querySelector(".modal-overlay").remove();
        initDashboard();
      }, 1000);
    } else {
      showStatus(
        "assign-event-status",
        data.addVolunteerToEvent.message,
        "error"
      );
    }
  } catch (err) {
    showStatus("assign-event-status", `Error: ${err.message}`, "error");
  }
}

async function removeVolunteerFromEvent(volunteerId, eventId) {
  if (!confirm("Remove this volunteer from the event?")) return;

  try {
    const mutation = `
      mutation RemoveVolunteerFromEvent($volunteerId: Int!, $eventId: Int!) {
        removeVolunteerFromEvent(volunteerId: $volunteerId, eventId: $eventId) {
          success
          message
        }
      }
    `;

    await gqlRequest(mutation, { volunteerId, eventId });

    document.querySelector(".modal-overlay").remove();
    initDashboard();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

function openEditVolunteerModal(volunteerId, firstName, lastName) {
  const modalHTML = `
    <div class="modal-header">
      <h2 class="modal-title">Edit Volunteer</h2>
      <button class="close-button" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    
    <form id="edit-volunteer-form">
      <div class="form-group">
        <label class="form-label">First Name</label>
        <input type="text" id="edit-volunteer-firstname" value="${firstName}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Last Name</label>
        <input type="text" id="edit-volunteer-lastname" value="${lastName}" required />
      </div>
      <button type="submit">Save Changes</button>
      <div id="edit-volunteer-status" style="display: none;"></div>
    </form>
  `;

  const overlay = openModal(modalHTML);

  document
    .getElementById("edit-volunteer-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const newFirstName = document
        .getElementById("edit-volunteer-firstname")
        .value.trim();
      const newLastName = document
        .getElementById("edit-volunteer-lastname")
        .value.trim();

      try {
        const mutation = `
          mutation UpdateVolunteer($volunteerId: Int!, $firstName: String, $lastName: String) {
            updateVolunteer(volunteerId: $volunteerId, firstName: $firstName, lastName: $lastName) {
              id
              firstName
              lastName
            }
          }
        `;

        await gqlRequest(mutation, {
          volunteerId,
          firstName: newFirstName,
          lastName: newLastName,
        });

        showStatus(
          "edit-volunteer-status",
          "Volunteer updated successfully!",
          "success"
        );

        setTimeout(() => {
          closeModal(overlay);
          initDashboard();
        }, 1500);
      } catch (err) {
        showStatus("edit-volunteer-status", `Error: ${err.message}`, "error");
      }
    });
}

async function deleteVolunteer(volunteerId) {
  if (
    !confirm(
      "Are you sure you want to delete this volunteer? This will also remove all their service records."
    )
  ) {
    return;
  }

  try {
    const mutation = `
      mutation DeleteVolunteer($volunteerId: Int!) {
        deleteVolunteer(volunteerId: $volunteerId) {
          success
          message
        }
      }
    `;

    const data = await gqlRequest(mutation, { volunteerId });

    if (data.deleteVolunteer.success) {
      document.querySelector(".modal-overlay").remove();
      initDashboard();
    } else {
      alert(data.deleteVolunteer.message);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}
