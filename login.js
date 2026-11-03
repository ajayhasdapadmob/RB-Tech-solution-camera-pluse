
import { auth, db, authReady } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const $ = id => document.getElementById(id);

const loginForm = $("customerLoginForm");
const emailInput = $("email");
const passwordInput = $("password");
const loginBtn = $("loginBtn");
const resetBtn = $("resetBtn");
const loginMessage = $("loginMessage");

function message(text, error = false) {
  loginMessage.textContent = text;
  loginMessage.style.color = error ? "#dc2626" : "#087f3c";
}

async function getCustomer(uid) {
  const customerQuery = query(
    collection(db, "customers"),
    where("uid", "==", uid)
  );

  const snapshot = await getDocs(customerQuery);

  if (snapshot.empty) return null;

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data()
  };
}

function checkSubscription(customer) {
  if (customer.status !== "active") {
    return "Your account is inactive. Please contact the administrator.";
  }

  if (!customer.subscriptionExpiry ||
      typeof customer.subscriptionExpiry.toDate !== "function") {
    return "Subscription expiry is missing or invalid. Please contact the administrator.";
  }

  if (customer.subscriptionExpiry.toDate().getTime() <= Date.now()) {
    return "Your subscription has expired. Please contact the administrator.";
  }

  return "";
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();

  loginBtn.disabled = true;
  loginBtn.textContent = "Checking...";
  message("Logging in...");

  try {
    await authReady;

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    const result = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const customer = await getCustomer(result.user.uid);

    if (!customer) {
      await signOut(auth);
      throw new Error("Customer account record not found. Contact administrator.");
    }

    const subscriptionError = checkSubscription(customer);

    if (subscriptionError) {
      await signOut(auth);
      throw new Error(subscriptionError);
    }

    sessionStorage.setItem("rbCustomerId", customer.id);

    message("Login successful. Opening dashboard...");

    window.location.href = "./customer-dashboard.html";

  } catch (error) {
    console.error("Customer login error:", error);
    message(error.message || "Login failed.", true);

  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Login";
  }
});

resetBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();

  if (!email) {
    message("Please enter your email address first.", true);
    emailInput.focus();
    return;
  }

  resetBtn.disabled = true;
  message("Sending password reset email...");

  try {
    await sendPasswordResetEmail(auth, email);
    message("Password reset email sent. Please check your inbox.");

  } catch (error) {
    console.error("Password reset error:", error);
    message(error.message, true);

  } finally {
    resetBtn.disabled = false;
  }
});

// If customer is already logged in, verify account before redirecting.
onAuthStateChanged(auth, async user => {
  if (!user) return;

  try {
    await authReady;

    const customer = await getCustomer(user.uid);

    if (!customer) {
      await signOut(auth);
      return;
    }

    const subscriptionError = checkSubscription(customer);

    if (subscriptionError) {
      message(subscriptionError, true);
      await signOut(auth);
      return;
    }

    sessionStorage.setItem("rbCustomerId", customer.id);
    window.location.href = "./customer-dashboard.html";

  } catch (error) {
    console.error("Existing login check error:", error);
    message("Account verification failed. Please try again.", true);
  }
});
