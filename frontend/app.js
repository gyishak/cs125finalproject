const GRAPHQL_URL = "http://127.0.0.1:8000/graphql";

// Helper to send GraphQL queries/mutations
async function gqlRequest(query, variables = {}) {
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
}

async function render() {
  const app = document.getElementById("app");
  app.innerHTML =
    "<h1 class='dashboard-title'>Youth Group Leader Dashboard</h1><p>Loading…</p>";

  try {
    const query = `
      query Dashboard($eventId: Int!) {
        students {
          id
          firstName
          lastName
        }
        events {
          id
          Type
          Notes
          eventTypeid
        }
        checkedInStudents(eventId: $eventId)
      }
    `;

    const eventId = 1; // default event we’re viewing
    const data = await gqlRequest(query, { eventId });

    const studentsList = data.students
      .map((s) => `<li>#${s.id} — ${s.firstName} ${s.lastName}</li>`)
      .join("");

    const eventsList = data.events
      .map(
        (e) =>
          `<li>#${e.id} — ${e.Type} <span class="empty-state">(${e.Notes})</span></li>`
      )
      .join("");

    const checkedInList =
      data.checkedInStudents.length > 0
        ? data.checkedInStudents
            .map((id) => `<li>Student ID: ${id}</li>`)
            .join("")
        : `<p class="empty-state">No one is currently checked in for this event.</p>`;

    // ---------- Page HTML with cards ----------
    app.innerHTML = `
      <header class="dashboard-header">
        <h1 class="dashboard-title">Youth Group Leader Dashboard</h1>
        <p class="dashboard-subtitle">
          Quick view of students, events, and live attendance for tonight's gathering.
        </p>
      </header>

      <main class="dashboard-grid">
        <!-- Students card -->
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Students</h2>
            <span class="card-tag">${data.students.length} total</span>
          </div>
          <ul>${studentsList}</ul>
        </section>

        <!-- Events card -->
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Events</h2>
            <span class="card-tag">Event types</span>
          </div>
          <ul>${eventsList}</ul>
        </section>

        <!-- Checked-in card -->
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Checked-in Students</h2>
            <span class="card-tag">Event ${eventId}</span>
          </div>
          <ul id="checked-in-list">
            ${checkedInList}
          </ul>
        </section>

        <!-- Check-in form card -->
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Check In a Student</h2>
            <span class="card-tag">Live</span>
          </div>

          <form id="checkin-form">
            <div class="form-group">
              <label for="event-id">Event ID</label>
              <input type="number" id="event-id" value="${eventId}" required />
            </div>

            <div class="form-group">
              <label for="student-id">Student ID</label>
              <input type="number" id="student-id" required />
            </div>

            <button type="submit">Check In</button>
          </form>
          <p id="status"></p>
        </section>

        <!-- Persist attendance card -->
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Persist Attendance to MySQL</h2>
            <span class="card-tag">End of night</span>
          </div>
          <button id="persist-btn">Save Attendance for Event ${eventId}</button>
          <p id="persist-status"></p>
        </section>
      </main>
    `;

    // ---------- CHECK-IN FORM (REST /event/check-in) ----------
    const checkInForm = document.getElementById("checkin-form");
    const status = document.getElementById("status");

    checkInForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.textContent = "Checking in…";

      const eventID = parseInt(document.getElementById("event-id").value, 10);
      const studentID = parseInt(
        document.getElementById("student-id").value,
        10
      );

      try {
        const res = await fetch("http://127.0.0.1:8000/event/check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventID, studentID }),
        });

        const result = await res.json();
        console.log("Check-in result:", result);

        status.textContent = `Student ${result.student_id} is ${result.student_status} for event ${result.event_id}.`;

        // Reload to refresh checked-in list
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } catch (err) {
        console.error(err);
        status.textContent = "Error during check-in.";
      }
    });

    // ---------- PERSIST ATTENDANCE (GraphQL mutation) ----------
    const persistBtn = document.getElementById("persist-btn");
    const persistStatus = document.getElementById("persist-status");

    persistBtn.addEventListener("click", async () => {
      persistStatus.textContent = "Saving attendance…";

      const mutation = `
        mutation Persist($eventId: Int!) {
          persistAttendance(eventId: $eventId)
        }
      `;

      try {
        const result = await gqlRequest(mutation, { eventId });
        console.log("Persist result:", result);

        if (result.persistAttendance) {
          persistStatus.textContent =
            "Attendance saved to MySQL and cleared from Redis.";
          setTimeout(() => {
            window.location.reload();
          }, 800);
        } else {
          persistStatus.textContent = "No check-ins to save for this event.";
        }
      } catch (err) {
        console.error(err);
        persistStatus.textContent =
          "Error while saving attendance: " + err.message;
      }
    });
  } catch (err) {
    console.error("Render error:", err);
    app.innerHTML = `
      <div class="dashboard-header">
        <h1 class="dashboard-title">Youth Group Leader Dashboard</h1>
        <p class="dashboard-subtitle">Error loading data: ${err.message}</p>
      </div>
    `;
  }
}

render();
