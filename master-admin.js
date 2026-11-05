import { auth, db, authReady } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ========================================
// ELEMENTS
// ========================================

const logoutBtn = document.getElementById("logoutBtn");
const customerForm = document.getElementById("customerForm");
const messageBox = document.getElementById("message");
const customerTableBody = document.getElementById("customerTableBody");
const createCustomerBtn = document.getElementById("createCustomerBtn");

let isMasterAdminVerified = false;

// ========================================
// HELPERS
// ========================================

function showMessage(message, color = "#b91c1c") {
  if (!messageBox) return;

  messageBox.textContent = message;
  messageBox.style.color = color;
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

function getTodayInputDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function calculateExpiry(startDate, plan) {
  const expiry = new Date(startDate);

  if (plan === "yearly") {
    expiry.setFullYear(expiry.getFullYear() + 1);
  } else {
    expiry.setMonth(expiry.getMonth() + 1);
  }

  return expiry;
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

// ========================================
// MASTER ADMIN VERIFICATION
// ========================================

async function checkMasterAdmin(user) {
  if (!user?.uid) {
    throw new Error("Please login with your Master Admin account.");
  }

  const adminRef = doc(db, "admin", user.uid);
  const adminSnap = await getDoc(adminRef);

  if (!adminSnap.exists()) {
    throw new Error("Master Admin document not found for this login UID.");
  }

  const adminData = adminSnap.data();

  if (adminData.Active !== true) {
    throw new Error("Admin account is inactive.");
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

    const businessName = escapeHTML(
      customer.businessName || "Unnamed Business"
    );

    const ownerName = escapeHTML(customer.ownerName || "—");
    const slug = escapeHTML(customer.slug || customerId);
    const plan = escapeHTML(customer.plan || "—");
    const expiryText = escapeHTML(
      formatDate(customer.subscriptionExpiry)
    );

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
        <td>${expiryText}</td>
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

  const errors = [];

  try {
    await loadCustomers();
  } catch (error) {
    console.error("Customer loading error:", error);
    errors.push("Customers: " + error.message);

    if (customerTableBody) {
      customerTableBody.innerHTML = `
        <tr>
          <td colspan="7">
            Unable to load customers: ${escapeHTML(error.message)}
          </td>
        </tr>
      `;
    }
  }

  try {
    await loadEnquiries();
  } catch (error) {
    console.error("Enquiry loading error:", error);
    errors.push("Enquiries: " + error.message);
  }

  if (errors.length) {
    showMessage(errors.join(" | "));
    return;
  }

  showMessage(
    "Master Admin verified. Dashboard data loaded successfully.",
    "#087f3c"
  );
}

// ========================================
// CREATE CUSTOMER PROFILE
// ========================================

async function createCustomer(event) {
  event.preventDefault();

  if (!isMasterAdminVerified) {
    showMessage("Master Admin verification is required.");
    return;
  }

  if (!auth.currentUser) {
    showMessage("Please login again.");
    return;
  }

  const businessName =
    document.getElementById("businessName").value.trim();

  const ownerName =
    document.getElementById("ownerName").value.trim();

  const email =
    document.getElementById("customerEmail").value.trim().toLowerCase();

  const phone =
    document.getElementById("customerPhone").value.trim();

  const customerUid =
    document.getElementById("customerAuthUid").value.trim();

  const slug = normalizeSlug(
    document.getElementById("customerSlug").value
  );

  const plan =
    document.getElementById("subscriptionPlan").value;

  const amount = Number(
    document.getElementById("subscriptionAmount").value
  );

  const startValue =
    document.getElementById("subscriptionStart").value;

  const whatsapp =
    document.getElementById("customerWhatsApp").value.trim();

  const status =
    document.getElementById("customerStatus").value;

  const address =
    document.getElementById("customerAddress").value.trim();

  // Basic validation

  if (
    !businessName ||
    !ownerName ||
    !email ||
    !phone ||
    !customerUid ||
    !slug ||
    !startValue
  ) {
    showMessage("Please fill all required fields.");
    return;
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    showMessage("Website Link Name: use only letters, numbers and hyphens.");
    return;
  }

  if (!Number.isFinite(amount) || amount < 0) {
    showMessage("Please enter a valid subscription amount.");
    return;
  }

  if (!["monthly", "yearly"].includes(plan)) {
    showMessage("Invalid subscription plan.");
    return;
  }

  if (!["active", "inactive"].includes(status)) {
    showMessage("Invalid customer status.");
    return;
  }

  if (customerUid === auth.currentUser.uid) {
    showMessage("Master Admin UID cannot be used as a customer UID.");
    return;
  }

  const startDate = new Date(`${startValue}T00:00:00`);

  if (Number.isNaN(startDate.getTime())) {
    showMessage("Please enter a valid subscription start date.");
    return;
  }

  const expiryDate = calculateExpiry(startDate, plan);

  createCustomerBtn.disabled = true;
  createCustomerBtn.textContent = "Creating Customer...";

  try {
    // Recheck Master Admin permission before writing.

    await checkMasterAdmin(auth.currentUser);

    // Check whether the selected website slug already exists.

    const customerRef = doc(db, "customers", slug);
    const existingCustomer = await getDoc(customerRef);

    if (existingCustomer.exists()) {
      throw new Error(
        "This Website Link Name already exists. Please use another slug."
      );
    }

    // Check whether this Authentication UID is already registered.

    const uidQuery = query(
      collection(db, "customers"),
      where("uid", "==", customerUid)
    );

    const uidSnapshot = await getDocs(uidQuery);

    if (!uidSnapshot.empty) {
      throw new Error(
        "This Firebase Authentication UID is already linked to a customer."
      );
    }

    // Create only the Firestore customer profile.
    // The Authentication account must already exist in Firebase Console.

    const customerData = {
      businessName: businessName,
      ownerName: ownerName,
      email: email,
      phone: phone,
      uid: customerUid,
      slug: slug,
      plan: plan,
      subscriptionAmount: amount,
      subscriptionStart: Timestamp.fromDate(startDate),
      subscriptionExpiry: Timestamp.fromDate(expiryDate),
      status: status,
      whatsapp: whatsapp,
      address: address,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(customerRef, customerData);

    showMessage(
      "Customer profile created successfully. Customer ID: " + slug,
      "#087f3c"
    );

    customerForm.reset();

    const startInput = document.getElementById("subscriptionStart");
    if (startInput) {
      startInput.value = getTodayInputDate();
    }

    await loadCustomers();

  } catch (error) {
    console.error("Create customer error:", error);

    if (error.code === "permission-denied") {
      showMessage(
        "Permission denied. Please check Firestore Security Rules."
      );
    } else {
      showMessage("Customer creation failed: " + error.message);
    }

  } finally {
    createCustomerBtn.disabled = false;
    createCustomerBtn.textContent = "Create Customer Profile";
  }
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

        const startInput =
          document.getElementById("subscriptionStart");

        if (startInput && !startInput.value) {
          startInput.value = getTodayInputDate();
        }

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
      document.body.style.display = "block";
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
// FORM SUBMIT
// ========================================

if (customerForm) {
  customerForm.addEventListener("submit", createCustomer);
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
