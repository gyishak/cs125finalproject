const GRAPHQL_URL = "http://127.0.0.1:8000/graphql";

async function gqlRequest(query, variables = {}) {
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    const json = await res.json();

    if (json.errors && json.errors.length > 0) {
      throw new Error(json.errors[0].message);
    }

    return json.data;
  } catch (err) {
    console.error("GraphQL error:", err);
    throw err;
  }
}

function showStatus(message, type = "error") {
  const statusEl = document.getElementById("login-status");
  statusEl.className = `status-text status-${type}`;
  statusEl.textContent = message;
  statusEl.style.display = "block";
}

function hideStatus() {
  const statusEl = document.getElementById("login-status");
  statusEl.style.display = "none";
}

// Check if already logged in
const currentLeader = sessionStorage.getItem("leaderId");
const currentLeaderName = sessionStorage.getItem("leaderName");

if (currentLeader) {
  // Already logged in, redirect to dashboard
  window.location.href = "index.html";
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideStatus();

  const leaderId = parseInt(document.getElementById("leader-id-input").value);

  if (!leaderId || leaderId < 1) {
    showStatus("Please enter a valid Leader ID", "error");
    return;
  }

  // Show loading
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Verifying...";

  try {
    // Query to verify leader exists
    const query = `
      query VerifyLeader($leaderId: Int!) {
        leaderById(leaderId: $leaderId) {
          id
          firstName
          lastName
        }
      }
    `;

    const data = await gqlRequest(query, { leaderId });

    if (!data.leaderById) {
      showStatus(
        "Leader ID not found. Please check your ID and try again.",
        "error"
      );
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

    const leader = data.leaderById;

    // Save to session storage
    sessionStorage.setItem("leaderId", leader.id);
    sessionStorage.setItem(
      "leaderName",
      `${leader.firstName} ${leader.lastName}`
    );

    // Show success
    showStatus(`Welcome back, ${leader.firstName}!`, "success");

    // Redirect to dashboard after short delay
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1000);
  } catch (err) {
    showStatus(`Error: ${err.message}`, "error");
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});
