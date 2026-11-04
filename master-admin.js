```javascript
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

// Initially disable customer form.
setDashboardEnabled(false);

// ========================================
// MASTER ADMIN VERIFICATION
// ========================================

async function checkMasterAdmin(user) {
  if (!user || !user.uid) {
    throw new Error("Please login with your Master Admin account.");
  }

  // Display logged-in UID for diagnosis.
  console.log("================================");
  console.log("MASTER ADMIN LOGIN CHECK");
  console.log("Logged-in UID:", user.uid);
  console.log("Checking Firestore path: admin/" + user.uid);
  console.log("================================");

  const adminRef = doc(db, "admin", user.uid);

  let adminSnap;

  try {
    adminSnap = await getDoc(adminRef);
  } catch (error) {
    console.error("Firestore admin document read failed:", error);

    if (error.code === "permission-denied") {
      throw new Error(
        "Firestore permission denied. Please check your Firestore Security Rules."
      );
    }

    throw new Error(
      "Unable to read Admin document: " + error.message
    );
  }

  if (!adminSnap.exists()) {
    console.error("Admin document not found for UID:", user.uid);

    throw new Error(
      "Admin document not found for logged-in UID: " + user.uid
    );
  }

  const adminData = adminSnap.data();

  console.log("Admin document found:", adminData);
  console.log("Active value:", adminData.Active);
  console.log("Active type:", typeof adminData.Active);
  console.log("Role value:", adminData.Role);
  console.log("Role type:", typeof adminData.Role);

  if (adminData.Active !== true) {
    throw new Error(
      "Admin account is inactive. Active must be Boolean true."
    );
  }

  if (adminData.Role !== "MasterAdmin") {
    throw new Error(
      'Incorrect Admin Role. Role must be exactly "MasterAdmin".'
    );
  }

  console.log("MASTER ADMIN VERIFICATION SUCCESSFUL");

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
        console.log("No user is logged in.");

        document.body.style.display = "block";

        showMessage(
          "Please login first using the Admin Login page."
        );

        return;
      }

      // Show UID immediately.
      console.log("Logged-in UID:", user.uid);

      showMessage(
        "Checking Master Admin permission...",
        "#64748b"
      );

      try {
        await checkMasterAdmin(user);

        // Ensure same user is still logged in.
        if (auth.currentUser?.uid !== user.uid) {
          console.warn("Login user changed during verification.");
          return;
        }

        isMasterAdminVerified = true;

        document.body.style.display = "block";

        setDashboardEnabled(true);

        showMessage(
          "Master Admin verification successful.",
          "#087f3c"
        );

        console.log("Master Admin access granted.");

      } catch (error) {
        console.error(
          "Master Admin verification failed:",
          error
        );

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
      console.error("Authentication state error:", error);

      isMasterAdminVerified = false;

      setDashboardEnabled(false);

      document.body.style.display = "block";

      showMessage(
        "Authentication error: " + error.message
      );
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

      showMessage(
        "Logout failed: " + error.message
      );
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
      showMessage(
        "Master Admin verification is required."
      );

      return;
    }

    showMessage(
      "Customer creation backend is not connected yet.",
      "#b45309"
    );
  });
}

// ========================================
// START MASTER ADMIN
// ========================================

initializeMasterAdmin().catch(error => {
  console.error(
    "Master Admin initialization error:",
    error
  );

  isMasterAdminVerified = false;

  setDashboardEnabled(false);

  document.body.style.display = "block";

  showMessage(
    "Unable to initialize Master Admin: " +
    (error.message || "Unknown error.")
  );
});
