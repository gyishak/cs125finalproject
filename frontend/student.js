const GRAPHQL_URL = "http://127.0.0.1:8000/graphql";

async function gqlRequest(query, variables = {}) {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  console.log("Student GraphQL response:", json);

  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0].message);
  }

  return json.data;
}

function renderLookup() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <header class="dashboard-header">
      <h1 class="dashboard-title">Student / Parent View</h1>
      <p class="dashboard-subtitle">
        Look up attendance history and upcoming events for a student.
      </p>
    </header>

    <main class="dashboard-grid">
      <section class="card">
        <div class="card-header">
          <h2 class="card-title">Find Student</h2>
          <span class="card-tag">Lookup</span>
        </div>
        <form id="lookup-form">
          <div class="form-group">
            <label for="student-id-input">Student ID</label>
            <input type="number" id="student-id-input" required />
          </div>
          <button type="submit">View Student</button>
        </form>
        <p class="empty-state">Tip: In your sample data, IDs 1–4 are valid.</p>
      </section>
    </main>
  `;

  const form = document.getElementById("lookup-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById("student-id-input").value, 10);
    if (!id) return;
    renderStudentDashboard(id);
  });
}

async function renderStudentDashboard(studentId) {
  const app = document.getElementById("app");
  app.innerHTML = `
    <header class="dashboard-header">
      <h1 class="dashboard-title">Student / Parent View</h1>
      <p class="dashboard-subtitle">
        Loading student ${studentId}…
      </p>
    </header>
  `;

  const query = `
    query StudentDashboard($studentId: Int!) {
      studentById(studentId: $studentId) {
        id
        firstName
        lastName
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
        <header class="dashboard-header">
          <h1 class="dashboard-title">Student / Parent View</h1>
          <p class="dashboard-subtitle">
            No student found with ID ${studentId}.
          </p>
        </header>
        <main class="dashboard-grid">
          <section class="card">
            <div class="card-header">
              <h2 class="card-title">Try Again</h2>
              <span class="card-tag">Lookup</span>
            </div>
            <p class="empty-state">Please enter a valid student ID (for example 1–4).</p>
            <button id="back-btn">Back to Search</button>
          </section>
        </main>
      `;
      document
        .getElementById("back-btn")
        .addEventListener("click", renderLookup);
      return;
    }

    const student = data.studentById;

    const attendanceList =
      data.studentAttendance.length > 0
        ? `<ul>` +
          data.studentAttendance
            .map(
              (a) =>
                `<li>${a.theDATE} ${a.theTime} — Event #${a.eventId}${
                  a.eventName ? " (" + a.eventName + ")" : ""
                }</li>`
            )
            .join("") +
          `</ul>`
        : `<p class="empty-state">No recorded attendance yet for this student.</p>`;

    const eventsList =
      data.events.length > 0
        ? `<ul>` +
          data.events
            .map(
              (e) =>
                `<li>#${e.id} — ${e.Type} <span class="empty-state">(${e.Notes})</span></li>`
            )
            .join("") +
          `</ul>`
        : `<p class="empty-state">No upcoming events defined.</p>`;

    app.innerHTML = `
      <header class="dashboard-header">
        <h1 class="dashboard-title">Student / Parent View</h1>
        <p class="dashboard-subtitle">
          Attendance history and upcoming events for ${student.firstName} ${student.lastName}.
        </p>
      </header>

      <main class="dashboard-grid">
        <!-- Student info -->
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Student Info</h2>
            <span class="card-tag">ID ${student.id}</span>
          </div>
          <p><strong>Name:</strong> ${student.firstName} ${student.lastName}</p>
          <p class="empty-state">
            (In a full system, this card could also show guardian contact info, group, etc.)
          </p>
          <button id="back-btn">Search Another Student</button>
        </section>

        <!-- Attendance history -->
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Attendance History</h2>
            <span class="card-tag">Past check-ins</span>
          </div>
          ${attendanceList}
        </section>

        <!-- Upcoming events -->
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Upcoming Events</h2>
            <span class="card-tag">From Event table</span>
          </div>
          ${eventsList}
        </section>
      </main>
    `;

    document.getElementById("back-btn").addEventListener("click", renderLookup);
  } catch (err) {
    console.error("Student view error:", err);
    app.innerHTML = `
      <header class="dashboard-header">
        <h1 class="dashboard-title">Student / Parent View</h1>
        <p class="dashboard-subtitle">
          Error loading data: ${err.message}
        </p>
      </header>
    `;
  }
}

renderLookup();
