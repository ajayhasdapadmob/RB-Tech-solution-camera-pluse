
import { auth, db, authReady } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  collection,
  query,
  where,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ELEMENTS
const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");
const loginForm = document.getElementById("customerLoginForm");
const loginMessage = document.getElementById("loginMessage");
const dashboardMessage = document.getElementById("dashboardMessage");
const logoutBtn = document.getElementById("logoutBtn");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const customerName = document.getElementById("customerName");
const businessTitle = document.getElementById("businessTitle");
const subscriptionStatus = document.getElementById("subscriptionStatus");

const sectionContent = document.getElementById("sectionContent");

let currentCustomer = null;

// MESSAGE
function showLoginMessage(message, color = "#b91c1c") {
  if (!loginMessage) return;

  loginMessage.textContent = message;
  loginMessage.style.color = color;
}

function showDashboardMessage(message, color = "#087f3c") {
  if (!dashboardMessage) return;

  dashboardMessage.textContent = message;
  dashboardMessage.style.color = color;
}

// SHOW LOGIN
function showLogin() {
  loginSection.hidden = false;
  dashboardSection.hidden = true;
  logoutBtn.hidden = true;
  currentCustomer = null;
}

// SHOW DASHBOARD
function showDashboard() {
  loginSection.hidden = true;
  dashboardSection.hidden = false;
  logoutBtn.hidden = false;
}

// FIND CUSTOMER BY AUTH UID
async function getCustomerByUid(uid) {
  const customersRef = collection(db, "customers");

  const customerQuery = query(
    customersRef,
    where("uid", "==", uid),
    limit(1)
  );

  const snapshot = await getDocs(customerQuery);

  if (snapshot.empty) {
    throw new Error(
      "Customer record not found. Please contact RB Tech Solution."
    );
  }

  const customerDoc = snapshot.docs[0];

  return {
    id: customerDoc.id,
    ...customerDoc.data()
  };
}

// CHECK CUSTOMER STATUS AND SUBSCRIPTION
function checkSubscription(customer) {
  if (customer.status !== "active") {
    throw new Error("Your Customer Account is inactive.");
  }

  if (!customer.subscriptionExpiry) {
    throw new Error("Subscription expiry date is not set.");
  }

  const expiryDate =
    customer.subscriptionExpiry.toDate();

  if (Date.now() > expiryDate.getTime()) {
    throw new Error(
      "Your subscription has expired. Please contact RB Tech Solution for renewal."
    );
  }

  return true;
}

// LOAD CUSTOMER
async function loadCustomer(user) {
  const customer = await getCustomerByUid(user.uid);

  if (customer.uid !== user.uid) {
    throw new Error("Customer account verification failed.");
  }

  checkSubscription(customer);

  currentCustomer = customer;

  customerName.textContent =
    customer.businessName || "Customer";

  businessTitle.textContent =
    customer.businessName || "Customer Admin Panel";

  subscriptionStatus.textContent = "Active";

  showDashboard();

  showDashboardMessage(
    "Customer account verified successfully."
  );

  showSection("overview");
}

// DASHBOARD SECTIONS
function showSection(section) {
  if (!sectionContent) return;

  document.querySelectorAll("[data-section]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.section === section
    );
  });

  if (section === "overview") {
    sectionContent.innerHTML = `
      <h2>Dashboard Overview</h2>
      <p>Welcome to your business dashboard.</p>
      <p>Business: ${escapeHTML(currentCustomer?.businessName || "")}</p>
      <p>Website: /${escapeHTML(currentCustomer?.slug || "")}/</p>
    `;
  }

  else if (section === "products") {
    sectionContent.innerHTML = `
      <h2>Products</h2>
      <p>Your product management feature will be connected next.</p>
    `;
  }

  else if (section === "enquiries") {
    sectionContent.innerHTML = `
      <h2>Enquiries</h2>
      <p>Your customer enquiries will appear here after secure database setup.</p>
    `;
  }

  else if (section === "subscription") {
    const expiry = currentCustomer?.subscriptionExpiry;

    const expiryText = expiry
      ? expiry.toDate().toLocaleDateString("en-IN")
      : "Not set";

    sectionContent.innerHTML = `
      <h2>Subscription Details</h2>
      <p>Plan: ${escapeHTML(currentCustomer?.plan || "Not set")}</p>
      <p>Amount: ₹${Number(currentCustomer?.subscriptionAmount || 0)}</p>
      <p>Expiry Date: ${escapeHTML(expiryText)}</p>
    `;
  }
}

// SAFE HTML TEXT
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

// SECTION BUTTONS
document.querySelectorAll("[data-section]").forEach(button => {
  button.addEventListener("click", () => {
    if (!currentCustomer) return;

    showSection(button.dataset.section);
  });
});

// CUSTOMER LOGIN
if (loginForm) {
  loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showLoginMessage("Please enter email and password.");
      return;
    }

    const submitButton =
      loginForm.querySelector('button[type="submit"]');

    submitButton.disabled = true;
    showLoginMessage("Checking your account...", "#64748b");

    try {
      await authReady;

      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      showLoginMessage(
        "Login successful. Loading your account...",
        "#087f3c"
      );

    } catch (error) {
      console.error("Customer login error:", error);

      showLoginMessage(
        "Login failed. Please check your email and password."
      );

      submitButton.disabled = false;
    }
  });
}

// LOGOUT
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      showLogin();
      loginForm.reset();
      showLoginMessage("You have logged out.", "#087f3c");

    } catch (error) {
      console.error("Logout error:", error);
      alert("Logout failed. Please try again.");
    }
  });
}

// AUTH STATE
async function initializeCustomerAdmin() {
  await authReady;

  onAuthStateChanged(auth, async user => {
    if (!user) {
      showLogin();
      return;
    }

    try {
      await loadCustomer(user);

    } catch (error) {
      console.error("Customer verification error:", error);

      showLogin();
      await signOut(auth);

      showLoginMessage(
        error.message || "Customer account verification failed."
      );
    }
  });
}

// START
initializeCustomerAdmin().catch(error => {
  console.error("Customer Admin initialization error:", error);
  showLoginMessage("Unable to initialize Customer Admin.");
});
