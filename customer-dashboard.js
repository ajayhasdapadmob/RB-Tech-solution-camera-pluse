import { auth, db, authReady } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const $ = id => document.getElementById(id);

let currentCustomer = null;

function showMessage(text, error = false) {
  $("pageMessage").textContent = text;
  $("pageMessage").style.background = error ? "#fee2e2" : "#e0f2fe";
  $("pageMessage").style.color = error ? "#991b1b" : "#075985";
}

function safeText(value) {
  return value === undefined || value === null || value === ""
    ? "—"
    : String(value);
}

function formatDate(value) {
  if (!value) return "Not set";

  const date = typeof value.toDate === "function"
    ? value.toDate()
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "Invalid date";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function addItem(container, title, details) {
  const item = document.createElement("div");
  item.className = "item";

  const heading = document.createElement("strong");
  heading.textContent = title;

  const paragraph = document.createElement("p");
  paragraph.textContent = details;

  item.append(heading, paragraph);
  container.appendChild(item);
}

async function findCustomer(uid) {
  const savedId = sessionStorage.getItem("rbCustomerId");

  // Pehle saved customer document check karein.
  if (savedId) {
    const customerRef = doc(db, "customers", savedId);
    const customerSnap = await getDoc(customerRef);

    if (customerSnap.exists() && customerSnap.data().uid === uid) {
      return {
        id: customerSnap.id,
        ...customerSnap.data()
      };
    }
  }

  // Saved ID na mile toh UID se customer record search karein.
  const customerQuery = query(
    collection(db, "customers"),
    where("uid", "==", uid)
  );

  const snapshot = await getDocs(customerQuery);

  if (snapshot.empty) return null;

  const customerDoc = snapshot.docs[0];

  return {
    id: customerDoc.id,
    ...customerDoc.data()
  };
}

function checkSubscription(customer) {
  if (customer.status !== "active") {
    return "Your account is inactive. Please contact the administrator.";
  }

  if (
    !customer.subscriptionExpiry ||
    typeof customer.subscriptionExpiry.toDate !== "function"
  ) {
    return "Subscription expiry is missing or invalid.";
  }

  if (customer.subscriptionExpiry.toDate().getTime() <= Date.now()) {
    return "Your subscription has expired. Please contact the administrator.";
  }

  return "";
}

function displayCustomer(customer) {
  $("businessName").textContent = safeText(customer.businessName);
  $("businessDetail").textContent = safeText(customer.businessName);
  $("ownerName").textContent = safeText(customer.ownerName);
  $("email").textContent = safeText(customer.email);
  $("phone").textContent = safeText(customer.phone);

  $("plan").textContent = safeText(customer.plan);
  $("status").textContent = safeText(customer.status);
  $("amount").textContent = customer.subscriptionAmount == null
    ? "—"
    : "₹" + customer.subscriptionAmount;

  $("expiry").textContent = formatDate(customer.subscriptionExpiry);
}

async function loadCustomerProducts(customerId) {
  const container = $("productsList");
  container.textContent = "Loading products...";

  try {
    const productsQuery = query(
      collection(db, "customerProducts"),
      where("customerId", "==", customerId)
    );

    const snapshot = await getDocs(productsQuery);

    container.replaceChildren();

    if (snapshot.empty) {
      container.textContent = "No products found.";
      return;
    }

    snapshot.forEach(productDoc => {
      const product = productDoc.data();

      const name =
        product.name ||
        product.productName ||
        product.title ||
        "Unnamed Product";

      const model = product.model || product.modelNumber || "—";
      const category = product.category || "—";
      const price = product.price == null ? "—" : "₹" + product.price;

      addItem(
        container,
        name,
        `Model: ${model} | Category: ${category} | Price: ${price}`
      );
    });

  } catch (error) {
    console.error("Products loading error:", error);
    container.textContent =
      "Products could not be loaded. Please check Firestore rules.";
  }
}

async function loadCustomerEnquiries(customerId) {
  const container = $("enquiriesList");
  container.textContent = "Loading enquiries...";

  try {
    const enquiriesQuery = query(
      collection(db, "customerEnquiries"),
      where("customerId", "==", customerId)
    );

    const snapshot = await getDocs(enquiriesQuery);

    container.replaceChildren();

    if (snapshot.empty) {
      container.textContent = "No enquiries found.";
      return;
    }

    snapshot.forEach(enquiryDoc => {
      const enquiry = enquiryDoc.data();

      const name =
        enquiry.name ||
        enquiry.customerName ||
        enquiry.contactName ||
        "Customer enquiry";

      const phone = enquiry.phone || "—";
      const message = enquiry.message || enquiry.productName || "—";
      const status = enquiry.status || "Pending";

      addItem(
        container,
        name,
        `Phone: ${phone} | Details: ${message} | Status: ${status}`
      );
    });

  } catch (error) {
    console.error("Enquiries loading error:", error);
    container.textContent =
      "Enquiries could not be loaded. Please check Firestore rules.";
  }
}

async function openDashboard(user) {
  await authReady;

  const customer = await findCustomer(user.uid);

  if (!customer) {
    await signOut(auth);
    window.location.href = "./login.html";
    return;
  }

  const subscriptionError = checkSubscription(customer);

  if (subscriptionError) {
    showMessage(subscriptionError, true);
    await signOut(auth);
    sessionStorage.removeItem("rbCustomerId");
    return;
  }

  currentCustomer = customer;
  sessionStorage.setItem("rbCustomerId", customer.id);

  displayCustomer(customer);

  await Promise.all([
    loadCustomerProducts(customer.id),
    loadCustomerEnquiries(customer.id)
  ]);

  showMessage("Dashboard loaded successfully.");
}

$("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
    sessionStorage.removeItem("rbCustomerId");
    window.location.href = "./login.html";
  } catch (error) {
    console.error("Logout error:", error);
    showMessage("Logout failed. Please try again.", true);
  }
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = "./login.html";
    return;
  }

  try {
    await openDashboard(user);
  } catch (error) {
    console.error("Dashboard error:", error);
    showMessage(
      error.message || "Dashboard could not be loaded.",
      true
    );
  }
});
