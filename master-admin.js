
import { auth, db, authReady } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// MASTER ADMIN ELEMENTS
const logoutBtn = document.getElementById("logoutBtn");
const customerForm = document.getElementById("customerForm");
const messageBox = document.getElementById("message");

function showMessage(message, color = "#b91c1c") {
  if (!messageBox) return;

  messageBox.textContent = message;
  messageBox.style.color = color;
}

function setDashboardEnabled(enabled) {
  if (customerForm) {
    customerForm.querySelectorAll("input, select, textarea, button")
      .forEach(element => {
        element.disabled = !enabled;
      });
  }
}

// Initially keep customer creation disabled.
// It will be enabled only after Master Admin verification.
setDashboardEnabled(false);

// CHECK MASTER ADMIN PERMISSION
async function checkMasterAdmin(user) {
  try {
    const adminRef = doc(db, "admin", user.uid);
    const adminSnap = await getDoc(adminRef);

    if (!adminSnap.exists()) {
      throw new Error("Admin record not found.");
    }

    const adminData = adminSnap.data();

    if (adminData.Active !== true) {
      throw new Error("Your Admin account is inactive.");
    }

    if (adminData.Role !== "MasterAdmin") {
      throw new Error("Master Admin permission required.");
    }

    return true;

  } catch (error) {
    console.error("Master Admin verification failed:", error);
    throw error;
  }
}

// AUTHENTICATION CHECK
async function initializeMasterAdmin() {
  await authReady;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace("./admin.html");
      return;
    }

    try {
      await checkMasterAdmin(user);

      document.body.style.display = "block";
      setDashboardEnabled(true);

      showMessage(
        "Master Admin verification successful.",
        "#087f3c"
      );

      console.log("RB Tech Solution Master Admin verified.");

    } catch (error) {
      console.error(error);

      setDashboardEnabled(false);

      alert(
        "Master Admin Access Denied. Please login with the authorized account."
      );

      await signOut(auth);
      window.location.replace("./admin.html");
    }
  });
}

// LOGOUT
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.replace("./admin.html");
    } catch (error) {
      console.error("Logout error:", error);
      alert("Logout failed. Please try again.");
    }
  });
}

// CUSTOMER FORM IS NOT CONNECTED YET.
// Do not create customer accounts directly from browser code.
if (customerForm) {
  customerForm.addEventListener("submit", (event) => {
    event.preventDefault();

    showMessage(
      "Customer creation backend is not connected yet. Please wait for the next setup step.",
      "#b45309"
    );
  });
}

// START
initializeMasterAdmin().catch(error => {
  console.error("Master Admin initialization error:", error);
  showMessage("Unable to initialize Master Admin dashboard.");
});
