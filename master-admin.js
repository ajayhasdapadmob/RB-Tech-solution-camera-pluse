
import { auth, db, authReady } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ========================================
// MASTER ADMIN ELEMENTS
// ========================================

const logoutBtn = document.getElementById("logoutBtn");
const customerForm = document.getElementById("customerForm");
const messageBox = document.getElementById("message");

function showMessage(message, color = "#b91c1c") {
  if (!messageBox) {
    console.error(message);
    return;
  }

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

// Keep form disabled until verification succeeds.
setDashboardEnabled(false);

// ========================================
// MASTER ADMIN VERIFICATION
// ========================================

async function checkMasterAdmin(user) {
  if (!user || !user.uid) {
    throw new Error("Please login with your Master Admin account.");
  }

  const adminRef = doc(db, "admin", user.uid);
  const adminSnap = await getDoc(adminRef);

  if (!adminSnap.exists()) {
    throw new Error(
      "Admin record not found for this login UID: " + user.uid
    );
  }

  const adminData = adminSnap.data();

  if (adminData.Active !== true) {
    throw new Error("Your Admin account is inactive.");
  }

  if (adminData.Role !== "MasterAdmin") {
    throw new Error("This account does not have Master Admin permission.");
  }

  return true;
}

// ========================================
// AUTH STATE
// ========================================

let authCheckStarted = false;

async function initializeMasterAdmin() {
  try {
    await authReady;
  } catch (error) {
    console.error("Firebase Auth setup error:", error);
    showMessage("Firebase login setup failed: " + error.message);
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (authCheckStarted) return;
    authCheckStarted = true;

    if (!user) {
      showMessage("Please login first using the Admin Login page.");
      setDashboardEnabled(false);
      return;
    }

    showMessage("Checking Master Admin permission...", "#64748b");

    try {
      await checkMasterAdmin(user);

      document.body.style.display = "block";
      setDashboardEnabled(true);

      showMessage(
        "Master Admin verification successful.",
        "#087f3c"
      );

      console.log("Master Admin verified:", user.uid);

    } catch (error) {
      console.error("Master Admin verification failed:", error);

      setDashboardEnabled(false);
      document.body.style.display = "block";

      showMessage(
        "Master Admin access failed: " + error.message
      );

      // Do not sign out automatically.
      // This keeps the actual verification error visible.
    }
  }, (error) => {
    console.error("Auth state error:", error);
    showMessage("Authentication error: " + error.message);
  });
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

// Customer creation backend is not connected yet.
// Keep this message until the secure backend is implemented.
if (customerForm) {
  customerForm.addEventListener("submit", (event) => {
    event.preventDefault();

    showMessage(
      "Customer creation backend is not connected yet.",
      "#b45309"
    );
  });
}

// ========================================
// START
// ========================================

initializeMasterAdmin().catch(error => {
  console.error("Master Admin initialization error:", error);

  document.body.style.display = "block";

  showMessage(
    "Unable to initialize Master Admin: " + error.message
  );
});
