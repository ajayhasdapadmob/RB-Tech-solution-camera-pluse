
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
  Timestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ========================================
// CONFIGURATION
// ========================================

const UPI_ID = "9353689775@upi";
const MASTER_ADMIN_UID = "J13WbOAxtNWe3u7lQN4pSXLUMjI3";

let isMasterAdminVerified = false;
let subscriptionRequestsContainer = null;

// ========================================
// ELEMENTS
// ========================================

const logoutBtn = document.getElementById("logoutBtn");
const customerForm = document.getElementById("customerForm");
const messageBox = document.getElementById("message");
const customerTableBody = document.getElementById("customerTableBody");
const createCustomerBtn = document.getElementById("createCustomerBtn");

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

function formatDateTime(value) {
  const date = getDate(value);

  if (!date) return "Not available";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getTodayInputDate() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

function calculateExpiry(startDate, plan) {
  const expiry = new Date(startDate);
  const originalDay = expiry.getDate();

  if (plan === "yearly") {
    const targetYear = expiry.getFullYear() + 1;
    const targetMonth = expiry.getMonth();

    const lastDay = new Date(
      targetYear,
      targetMonth + 1,
      0
    ).getDate();

    expiry.setDate(1);
    expiry.setFullYear(targetYear);
    expiry.setMonth(targetMonth);
    expiry.setDate(Math.min(originalDay, lastDay));

    return expiry;
  }

  const target = new Date(
    expiry.getFullYear(),
    expiry.getMonth() + 1,
    1,
    expiry.getHours(),
    expiry.getMinutes(),
    expiry.getSeconds(),
    expiry.getMilliseconds()
  );

  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0
  ).getDate();

  target.setDate(Math.min(originalDay, lastDay));

  return target;
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

  console.log("MASTER ADMIN LOGIN UID:", user.uid);
  console.log("FIREBASE PROJECT ID:", db.app.options.projectId);

  if (user.uid !== MASTER_ADMIN_UID) {
    throw new Error(
      "Logged-in UID does not match the configured Master Admin UID."
    );
  }

  if (db.app.options.projectId !== "rb-tech-solution") {
    throw new Error(
      "Wrong Firebase project connected. Expected rb-tech-solution."
    );
  }

  const adminRef = doc(db, "admin", user.uid);
  const adminSnap = await getDoc(adminRef);

  console.log("ADMIN DOCUMENT EXISTS:", adminSnap.exists());

  if (!adminSnap.exists()) {
    throw new Error(
      "Master Admin document not found. Check admin document ID and Firebase project."
    );
  }

  const adminData = adminSnap.data();

  console.log("ADMIN DATA:", adminData);

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
    <tr><td colspan="7">Loading customers...</td></tr>
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

    const statusText = isExpired
      ? "Expired"
      : status === "active"
        ? "Active"
        : "Inactive";

    const statusColor =
      statusText === "Active" ? "#087f3c" : "#b91c1c";

    rows.push(`
      <tr>
        <td>${escapeHTML(customer.businessName || "Unnamed Business")}</td>
        <td>${escapeHTML(customer.ownerName || "—")}</td>
        <td>${escapeHTML(customer.slug || customerId)}</td>
        <td>${escapeHTML(customer.plan || "—")}</td>
        <td>${escapeHTML(formatDate(customer.subscriptionExpiry))}</td>
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
// SUBSCRIPTION REQUEST PANEL
// ========================================

function createSubscriptionPanel() {
  if (document.getElementById("subscriptionRequestsPanel")) {
    subscriptionRequestsContainer = document.getElementById(
      "subscriptionRequestsList"
    );
    return;
  }

  const panel = document.createElement("section");

  panel.id = "subscriptionRequestsPanel";

  panel.style.cssText = `
    margin:30px 0;
    padding:22px;
    background:#ffffff;
    color:#172033;
    border:1px solid #e2e8f0;
    border-radius:14px;
    box-shadow:0 4px 15px rgba(0,0,0,0.05);
  `;

  panel.innerHTML = `
    <div style="
      display:flex;
      justify-content:space-between;
      align-items:center;
      flex-wrap:wrap;
      gap:12px;
      margin-bottom:15px;
    ">
      <div>
        <h2 style="margin:0 0 6px;font-size:22px;">
          Subscription Payment Requests
        </h2>
        <p style="margin:0;color:#64748b;">
          Verify customer UTR and approve or reject renewal requests.
        </p>
      </div>

      <button
        type="button"
        id="refreshSubscriptionRequests"
        style="
          padding:10px 16px;
          border:0;
          border-radius:8px;
          background:#075b30;
          color:white;
          cursor:pointer;
        "
      >
        Refresh Requests
      </button>
    </div>

    <div style="
      display:flex;
      flex-wrap:wrap;
      gap:12px;
      margin-bottom:18px;
    ">
      <div style="flex:1;min-width:130px;padding:14px;background:#f1f5f9;border-radius:10px;">
        <div style="color:#64748b;font-size:13px;">Total Requests</div>
        <strong id="totalSubscriptionRequests" style="font-size:24px;">0</strong>
      </div>

      <div style="flex:1;min-width:130px;padding:14px;background:#fff7ed;border-radius:10px;">
        <div style="color:#9a3412;font-size:13px;">Pending Requests</div>
        <strong id="pendingSubscriptionRequests" style="font-size:24px;">0</strong>
      </div>

      <div style="flex:1;min-width:130px;padding:14px;background:#f0fdf4;border-radius:10px;">
        <div style="color:#166534;font-size:13px;">Approved Requests</div>
        <strong id="approvedSubscriptionRequests" style="font-size:24px;">0</strong>
      </div>
    </div>

    <div id="subscriptionRequestsList">
      Loading subscription requests...
    </div>

    <p style="
      margin:18px 0 0;
      padding:12px;
      background:#fff7ed;
      color:#9a3412;
      border-radius:8px;
      font-size:13px;
    ">
      Verify the UTR in your UPI or bank app before approving payment.
      UPI ID: ${UPI_ID}
    </p>
  `;

  const target =
    document.querySelector("main") ||
    document.querySelector(".container") ||
    document.body;

  target.appendChild(panel);

  subscriptionRequestsContainer = document.getElementById(
    "subscriptionRequestsList"
  );

  document
    .getElementById("refreshSubscriptionRequests")
    .addEventListener("click", async () => {
      if (isMasterAdminVerified) {
        await loadSubscriptionRequests();
      }
    });

  subscriptionRequestsContainer.addEventListener("click", async event => {
    const button = event.target.closest("[data-request-action]");

    if (!button) return;

    if (!isMasterAdminVerified) {
      showMessage("Master Admin verification is required.");
      return;
    }

    const action = button.dataset.requestAction;
    const requestId = button.dataset.requestId;

    if (!requestId) return;

    if (action === "approve") {
      await approveSubscriptionRequest(requestId, button);
    }

    if (action === "reject") {
      await rejectSubscriptionRequest(requestId, button);
    }
  });
}

// ========================================
// LOAD SUBSCRIPTION REQUESTS
// ========================================

async function loadSubscriptionRequests() {
  if (!subscriptionRequestsContainer) {
    createSubscriptionPanel();
  }

  subscriptionRequestsContainer.innerHTML =
    `<p style="color:#64748b;">Loading subscription requests...</p>`;

  try {
    const snapshot = await getDocs(
      collection(db, "subscriptionRequests")
    );

    const requests = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    requests.sort((a, b) => {
      const dateA = getDate(a.createdAt)?.getTime() || 0;
      const dateB = getDate(b.createdAt)?.getTime() || 0;
      return dateB - dateA;
    });

    const pendingCount = requests.filter(
      item => item.status === "pending"
    ).length;

    const approvedCount = requests.filter(
      item => item.status === "approved"
    ).length;

    setStat("totalSubscriptionRequests", requests.length);
    setStat("pendingSubscriptionRequests", pendingCount);
    setStat("approvedSubscriptionRequests", approvedCount);

    if (!requests.length) {
      subscriptionRequestsContainer.innerHTML = `
        <div style="padding:20px;text-align:center;background:#f8fafc;border-radius:10px;color:#64748b;">
          No subscription renewal requests found.
        </div>
      `;
      return;
    }

    subscriptionRequestsContainer.innerHTML = requests.map(request => {
      const status = String(request.status || "pending").toLowerCase();

      const statusColor =
        status === "approved" ? "#15803d" :
        status === "rejected" ? "#b91c1c" :
        "#c2410c";

      const statusBackground =
        status === "approved" ? "#dcfce7" :
        status === "rejected" ? "#fee2e2" :
        "#ffedd5";

      const actions = status === "pending"
        ? `
          <div style="display:flex;flex-wrap:wrap;gap:9px;margin-top:15px;">
            <button
              type="button"
              data-request-action="approve"
              data-request-id="${escapeHTML(request.id)}"
              style="padding:10px 17px;border:0;border-radius:7px;background:#15803d;color:white;cursor:pointer;"
            >Approve Payment</button>

            <button
              type="button"
              data-request-action="reject"
              data-request-id="${escapeHTML(request.id)}"
              style="padding:10px 17px;border:0;border-radius:7px;background:#b91c1c;color:white;cursor:pointer;"
            >Reject</button>
          </div>
        `
        : `
          <p style="margin:14px 0 0;color:${statusColor};font-weight:bold;">
            ${escapeHTML(status.toUpperCase())}
            ${request.reviewedAt
              ? " · Reviewed: " + escapeHTML(formatDateTime(request.reviewedAt))
              : ""}
          </p>
        `;

      return `
        <article style="padding:17px;margin-bottom:13px;border:1px solid #e2e8f0;border-radius:11px;background:white;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <h3 style="margin:0;font-size:18px;">
              ${escapeHTML(request.businessName || "Customer")}
            </h3>

            <span style="padding:6px 11px;border-radius:20px;background:${statusBackground};color:${statusColor};font-size:12px;font-weight:bold;">
              ${escapeHTML(status.toUpperCase())}
            </span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:15px;">
            <div><small>Customer ID</small><div>${escapeHTML(request.customerId || "—")}</div></div>
            <div><small>Customer UID</small><div style="word-break:break-all;">${escapeHTML(request.customerUid || "—")}</div></div>
            <div><small>Plan</small><div>${escapeHTML(request.plan || "—")}</div></div>
            <div><small>Payment Amount</small><div style="font-weight:bold;">₹${escapeHTML(request.amount ?? "—")}</div></div>
            <div><small>Payment Method</small><div>${escapeHTML(request.paymentMethod || "UPI")}</div></div>
            <div><small>UPI ID</small><div>${escapeHTML(request.upiId || UPI_ID)}</div></div>
            <div><small>UTR / Transaction Reference</small><div style="font-weight:bold;word-break:break-all;color:#075b30;">${escapeHTML(request.utr || "Not provided")}</div></div>
            <div><small>Request Date</small><div>${escapeHTML(formatDateTime(request.createdAt))}</div></div>
          </div>

          ${actions}
        </article>
      `;
    }).join("");

    console.log("Subscription requests loaded:", requests.length);

  } catch (error) {
    console.error("Subscription request loading error:", error);

    subscriptionRequestsContainer.innerHTML = `
      <div style="padding:15px;background:#fee2e2;color:#991b1b;border-radius:9px;">
        Unable to load subscription requests: ${escapeHTML(error.message)}
      </div>
    `;
  }
}

// ========================================
// APPROVE SUBSCRIPTION REQUEST
// ========================================

async function approveSubscriptionRequest(requestId, button) {
  const confirmed = confirm(
    "Have you verified this UTR/payment in your UPI or bank app?\n\n" +
    "Only approve after confirming that payment was received."
  );

  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "Approving...";

  try {
    await checkMasterAdmin(auth.currentUser);

    const requestRef = doc(db, "subscriptionRequests", requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      throw new Error("Subscription request not found.");
    }

    const request = requestSnap.data();

    if (request.status !== "pending") {
      throw new Error("This request has already been reviewed.");
    }

    if (!request.customerId || !request.customerUid) {
      throw new Error("Customer information is missing.");
    }

    const customerRef = doc(db, "customers", request.customerId);
    const customerSnap = await getDoc(customerRef);

    if (!customerSnap.exists()) {
      throw new Error("Customer profile not found.");
    }

    const customer = customerSnap.data();

    if (customer.uid !== request.customerUid) {
      throw new Error("Customer UID does not match.");
    }

    if (!["monthly", "yearly"].includes(customer.plan)) {
      throw new Error("Invalid customer subscription plan.");
    }

    if (
      Number(customer.subscriptionAmount) !== Number(request.amount) ||
      customer.plan !== request.plan
    ) {
      throw new Error("Request amount or plan does not match the customer plan.");
    }

    if (!request.utr || String(request.utr).trim().length < 6) {
      throw new Error("Valid UTR/reference is missing.");
    }

    if (request.upiId !== UPI_ID) {
      throw new Error("UPI ID does not match the configured payment ID.");
    }

    const now = new Date();
    const oldExpiry = getDate(customer.subscriptionExpiry);

    const extensionStart =
      oldExpiry && oldExpiry > now ? oldExpiry : now;

    const newExpiry = calculateExpiry(extensionStart, customer.plan);

    const batch = writeBatch(db);

    batch.update(customerRef, {
      subscriptionStart: Timestamp.fromDate(extensionStart),
      subscriptionExpiry: Timestamp.fromDate(newExpiry),
      status: "active",
      updatedAt: serverTimestamp()
    });

    batch.update(requestRef, {
      status: "approved",
      reviewedAt: serverTimestamp(),
      reviewedBy: auth.currentUser.uid
    });

    await batch.commit();

    alert(
      "Payment approved successfully!\n\n" +
      "Customer: " + (customer.businessName || request.businessName) +
      "\nNew Expiry: " + formatDate(newExpiry)
    );

    showMessage(
      "Subscription approved. New expiry: " + formatDate(newExpiry),
      "#087f3c"
    );

    await loadSubscriptionRequests();
    await loadCustomers();

  } catch (error) {
    console.error("Subscription approval error:", error);

    showMessage("Approval failed: " + error.message);

    button.disabled = false;
    button.textContent = "Approve Payment";
  }
}

// ========================================
// REJECT SUBSCRIPTION REQUEST
// ========================================

async function rejectSubscriptionRequest(requestId, button) {
  if (!confirm("Are you sure you want to reject this payment request?")) {
    return;
  }

  button.disabled = true;
  button.textContent = "Rejecting...";

  try {
    await checkMasterAdmin(auth.currentUser);

    const requestRef = doc(db, "subscriptionRequests", requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      throw new Error("Subscription request not found.");
    }

    if (requestSnap.data().status !== "pending") {
      throw new Error("This request has already been reviewed.");
    }

    const batch = writeBatch(db);

    batch.update(requestRef, {
      status: "rejected",
      reviewedAt: serverTimestamp(),
      reviewedBy: auth.currentUser.uid
    });

    await batch.commit();

    showMessage("Subscription request rejected.", "#087f3c");

    await loadSubscriptionRequests();

  } catch (error) {
    console.error("Subscription rejection error:", error);

    showMessage("Rejection failed: " + error.message);

    button.disabled = false;
    button.textContent = "Reject";
  }
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
        <tr><td colspan="7">Unable to load customers: ${escapeHTML(error.message)}</td></tr>
      `;
    }
  }

  try {
    await loadEnquiries();
  } catch (error) {
    console.error("Enquiry loading error:", error);
    errors.push("Enquiries: " + error.message);
  }

  try {
    createSubscriptionPanel();
    await loadSubscriptionRequests();
  } catch (error) {
    console.error("Subscription requests error:", error);
    errors.push("Subscription requests: " + error.message);
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

  if (!isMasterAdminVerified || !auth.currentUser) {
    showMessage("Master Admin verification is required.");
    return;
  }

  const getValue = id =>
    document.getElementById(id)?.value.trim() || "";

  const businessName = getValue("businessName");
  const ownerName = getValue("ownerName");
  const email = getValue("customerEmail").toLowerCase();
  const phone = getValue("customerPhone");
  const customerUid = getValue("customerAuthUid");
  const slug = normalizeSlug(getValue("customerSlug"));
  const plan = getValue("subscriptionPlan");
  const amount = Number(getValue("subscriptionAmount"));
  const startValue = getValue("subscriptionStart");
  const whatsapp = getValue("customerWhatsApp");
  const status = getValue("customerStatus");
  const address = getValue("customerAddress");

  if (
    !businessName || !ownerName || !email || !phone ||
    !customerUid || !slug || !startValue
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

  if (createCustomerBtn) {
    createCustomerBtn.disabled = true;
    createCustomerBtn.textContent = "Creating Customer...";
  }

  try {
    await checkMasterAdmin(auth.currentUser);

    const customerRef = doc(db, "customers", slug);
    const existingCustomer = await getDoc(customerRef);

    if (existingCustomer.exists()) {
      throw new Error("This Website Link Name already exists.");
    }

    const uidQuery = query(
      collection(db, "customers"),
      where("uid", "==", customerUid)
    );

    const uidSnapshot = await getDocs(uidQuery);

    if (!uidSnapshot.empty) {
      throw new Error("This Authentication UID is already linked to a customer.");
    }

    const customerData = {
      businessName,
      ownerName,
      email,
      phone,
      uid: customerUid,
      slug,
      plan,
      subscriptionAmount: amount,
      subscriptionStart: Timestamp.fromDate(startDate),
      subscriptionExpiry: Timestamp.fromDate(expiryDate),
      status,
      whatsapp,
      address,
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
      showMessage("Permission denied. Please check Firestore Security Rules.");
    } else {
      showMessage("Customer creation failed: " + error.message);
    }

  } finally {
    if (createCustomerBtn) {
      createCustomerBtn.disabled = false;
      createCustomerBtn.textContent = "Create Customer Profile";
    }
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
