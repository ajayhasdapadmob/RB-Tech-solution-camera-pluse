
import { auth, db, authReady } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ========================================
// MASTER ADMIN ELEMENTS
// ========================================

const logoutBtn = document.getElementById("logoutBtn");
const customerForm = document.getElementById("customerForm");
const messageBox = document.getElementById("message");
const customerTableBody = document.getElementById("customerTableBody");

let isMasterAdminVerified = false;

function showMessage(message, color = "#b91c1c") {
  if (messageBox) {
    messageBox.textContent = message;
    messageBox.style.color = color;
  } else {
    console.log(message);
  }
}

function setDashboardEnabled(enabled) {
  if (!customerForm) return;

  customerForm
    .querySelectorAll("input, select, textarea, button")
    .forEach(element => {
      element.disabled = !enabled;
    });
}

function setStat(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function getDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = getDate(value);

  if (!date) return "Not set";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

// ========================================
// MASTER ADMIN VERIFICATION
// ========================================

async function checkMasterAdmin(user) {
  if (!user?.uid) {
    throw new Error("Please login with your Master Admin account.");
  }

  console.log("Logged-in UID:", user.uid);
  console.log("Checking admin/" + user.uid);

  const adminRef = doc(db, "admin", user.uid);
  const adminSnap = await getDoc(adminRef);

  if (!adminSnap.exists()) {
    throw new Error("Master Admin document not found for this login UID.");
  }

  const adminData = adminSnap.data();

  console.log("Admin data:", adminData);

  if (adminData.Active !== true) {
    throw new Error("Admin account is inactive. Active must be Boolean true.");
  }

  if (adminData.Role !== "MasterAdmin") {
    throw new Error('Role must be exactly "MasterAdmin".');
  }

  return true;
}

// ========================================
// LOAD CUSTOMERS
// ========================================

async function loadCustomers() {
  if (!customerTableBody) return;

  customerTableBody.innerHTML = `
    <tr>
      <td colspan="7">Loading customers...</td>
    </tr>
  `;

  const snapshot = await getDocs(collection(db, "customers"));

  const now = new Date();
  let total = 0;
  let active = 0;
  let expired = 0;

  const rows = [];

  snapshot.forEach(documentSnapshot => {
    const customer = documentSnapshot.data();
    const customerId = documentSnapshot.id;

    total++;

    const expiry = getDate(customer.subscriptionExpiry);
    const status = String(customer.status || "inactive").toLowerCase();

    const isExpired = expiry && expiry <= now;
    const isActive = status === "active" && !isExpired;

    if (isActive) active++;
    if (isExpired) expired++;

    const businessName = escapeHTML(customer.businessName || "Unnamed Business");
    const ownerName = escapeHTML(customer.ownerName || "—");
    const slug = escapeHTML(customer.slug || customerId);
    const plan = escapeHTML(customer.plan || "—");
    const expiryText = formatDate(customer.subscriptionExpiry);

    const statusText = isExpired
      ? "Expired"
      : status === "active"
        ? "Active"
        : "Inactive";

    const statusColor = isExpired || status !== "active"
      ? "#b91c1c"
      : "#087f3c";

    rows.push(`
      <tr>
        <td>${businessName}</td>
        <td>${ownerName}</td>
        <td>${slug}</td>
        <td>${plan}</td>
        <td>${escapeHTML(expiryText)}</td>
        <td>
          <span style="
            display:inline-block;
            padding:5px 9px;
            border-radius:20px;
            background:#f1f5f9;
            color:${statusColor};
          ">${statusText}</span>
        </td>
        <td>${escapeHTML(customerId)}</td>
      </tr>
    `);
  });

  setStat("totalCustomers", total);
  setStat("activeCustomers", active);
  setStat("expiredCustomers", expired);

  customerTableBody.innerHTML = rows.length
    ? rows.join("")
    : `<tr><td colspan="7">No customer records found.</td></tr>`;

  console.log("Customers loaded:", total);
}

// ========================================
// LOAD ENQUIRIES
// ========================================

async function loadEnquiries() {
  const snapshot = await getDocs(collection(db, "enquiries"));

  setStat("totalEnquiries", snapshot.size);

  console.log("Enquiries loaded:", snapshot.size);
}

// ========================================
// LOAD DASHBOARD
// ========================================

async function loadDashboard() {
  showMessage("Loading dashboard data...", "#64748b");

  let customerError = null;
  let enquiryError = null;

  try {
    await loadCustomers();
  } catch (error) {
    customerError = error;
    console.error("Customer loading error:", error);

    if (customerTableBody) {
      customerTableBody.innerHTML = `
        <tr>
          <td colspan="7">Unable to load customers: ${escapeHTML(error.message)}</td>
        </tr>
      `;
    }
  }

  try {
    await loadEnquiries();
  } catch (error) {
    enquiryError = error;
    console.error("Enquiry loading error:", error);
  }

  if (customerError || enquiryError) {
    const errors = [];

    if (customerError) errors.push("Customers: " + customerError.message);
    if (enquiryError) errors.push("Enquiries: " + enquiryError.message);

    showMessage(errors.join(" | "));
    return;
  }

  showMessage("Master Admin verified. Dashboard data loaded successfully.", "#087f3c");
}

// ========================================
// AUTH STATE
// ========================================

async function initializeMasterAdmin() {
  await authReady;

  onAuthStateChanged(
    auth,
    async user => {
      isMasterAdminVerified = false;
      setDashboardEnabled(false);

      if (!user) {
        document.body.style.display = "block";
        showMessage("Please login first using the Admin Login page.");
        return;
      }

      showMessage("Checking Master Admin permission...", "#64748b");

      try {
        await checkMasterAdmin(user);

        if (auth.currentUser?.uid !== user.uid) return;

        isMasterAdminVerified = true;
        document.body.style.display = "block";

        setDashboardEnabled(true);

        await loadDashboard();

        console.log("Master Admin access granted.");

      } catch (error) {
        console.error("Master Admin error:", error);

        isMasterAdminVerified = false;
        setDashboardEnabled(false);
        document.body.style.display = "block";

        showMessage("Master Admin access failed: " + error.message);
      }
    },
    error => {
      console.error("Authentication error:", error);
      showMessage("Authentication error: " + error.message);
    }
  );
}

// ========================================
// LOGOUT
// ========================================

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.replace("./admin.html");
    } catch (error) {
      console.error("Logout error:", error);
      showMessage("Logout failed: " + error.message);
    }
  });
}

// ========================================
// CUSTOMER FORM
// ========================================

if (customerForm) {
  customerForm.addEventListener("submit", event => {
    event.preventDefault();

    if (!isMasterAdminVerified) {
      showMessage("Master Admin verification is required.");
      return;
    }

    showMessage(
      "Customer creation requires a secure backend. No customer has been created yet.",
      "#b45309"
    );
  });
}

// ========================================
// START
// ========================================

setDashboardEnabled(false);

initializeMasterAdmin().catch(error => {
  console.error("Initialization error:", error);

  setDashboardEnabled(false);
  document.body.style.display = "block";

  showMessage("Unable to initialize: " + error.message);
});
