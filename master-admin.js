
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

let isMasterAdminVerified = false;

function showMessage(message, color = "#b91c1c") {
  if (messageBox) {
    messageBox.textContent = message;
    messageBox.style.color = color;
  } else {
    console.error(message);
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

// Keep customer form disabled until verification.
setDashboardEnabled(false);

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
    throw new Error("Master Admin record not found.");
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

async function initializeMasterAdmin() {
  await authReady;

  onAuthStateChanged(
    auth,
    async user => {
      isMasterAdminVerified = false;
      setDashboardEnabled(false);

      if (!user) {
        showMessage("Please login first using the Admin Login page.");
        return;
      }

      showMessage("Checking Master Admin permission...", "#64748b");

      try {
        await checkMasterAdmin(user);

        // Confirm same user is still signed in.
        if (auth.currentUser?.uid !== user.uid) return;

        isMasterAdminVerified = true;
        document.body.style.display = "block";
        setDashboardEnabled(true);

        showMessage(
          "Master Admin verification successful.",
          "#087f3c"
        );

        console.log("Master Admin verified.");

      } catch (error) {
        console.error("Master Admin verification failed:", error);

        isMasterAdminVerified = false;
        setDashboardEnabled(false);
        document.body.style.display = "block";

        showMessage(
          "Master Admin access failed: " +
          (error.message || "Verification failed.")
        );
      }
    },
    error => {
      console.error("Auth state error:", error);
      isMasterAdminVerified = false;
      setDashboardEnabled(false);
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

// Backend is not connected yet.
// This prevents the form from pretending to create customers.
if (customerForm) {
  customerForm.addEventListener("submit", event => {
    event.preventDefault();

    if (!isMasterAdminVerified) {
      showMessage("Master Admin verification is required.");
      return;
    }

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

  setDashboardEnabled(false);
  document.body.style.display = "block";

  showMessage(
    "Unable to initialize Master Admin: " +
    (error.message || "Unknown error.")
  );
});
