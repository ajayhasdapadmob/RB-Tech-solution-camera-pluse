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
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* =====================================
   RB TECH SOLUTION - CUSTOMER ADMIN
===================================== */

const $ = (id) => document.getElementById(id);

const loginSection = $("loginSection");
const dashboardSection = $("dashboardSection");
const loginForm = $("customerLoginForm");
const loginMessage = $("loginMessage");
const dashboardMessage = $("dashboardMessage");
const logoutBtn = $("logoutBtn");
const sectionContent = $("sectionContent");

let currentUser = null;
let currentCustomer = null;
let currentProducts = [];
let editingProductId = null;

$("year").textContent = new Date().getFullYear();

function showMessage(element, message, success = false) {
  if (!element) return;
  element.textContent = message || "";
  element.className = success ? "message success" : "message";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function showLogin() {
  loginSection.classList.remove("hidden");
  dashboardSection.classList.add("hidden");
  logoutBtn.classList.add("hidden");
}

function showDashboard() {
  loginSection.classList.add("hidden");
  dashboardSection.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
}

/* =====================================
   CUSTOMER LOOKUP
===================================== */

async function getCustomerByUid(uid) {
  const customersQuery = query(
    collection(db, "customers"),
    where("uid", "==", uid),
    limit(1)
  );

  const snapshot = await getDocs(customersQuery);

  if (snapshot.empty) {
    throw new Error("Customer account nahi mila. Admin se contact kijiye.");
  }

  const customerDoc = snapshot.docs[0];

  return {
    id: customerDoc.id,
    ...customerDoc.data()
  };
}

function checkSubscription(customer) {
  if (String(customer.status || "").toLowerCase() !== "active") {
    return {
      active: false,
      message: "Inactive"
    };
  }

  const expiry = customer.subscriptionExpiry;

  if (!expiry) {
    return {
      active: false,
      message: "Expiry date missing"
    };
  }

  const expiryDate = typeof expiry.toDate === "function"
    ? expiry.toDate()
    : new Date(expiry);

  if (Number.isNaN(expiryDate.getTime())) {
    return {
      active: false,
      message: "Invalid expiry date"
    };
  }

  if (expiryDate.getTime() < Date.now()) {
    return {
      active: false,
      message: "Expired"
    };
  }

  return {
    active: true,
    message: "Active"
  };
}

/* =====================================
   LOAD CUSTOMER
===================================== */

async function loadCustomer(user) {
  currentUser = user;
  showMessage(dashboardMessage, "Customer account checking...");

  try {
    currentCustomer = await getCustomerByUid(user.uid);

    const subscription = checkSubscription(currentCustomer);

    if (!subscription.active) {
      await signOut(auth);
      throw new Error(
        `Aapka subscription ${subscription.message} hai. Admin se contact kijiye.`
      );
    }

    $("customerName").textContent =
      currentCustomer.businessName ||
      currentCustomer.name ||
      user.email ||
      "Customer";

    $("businessTitle").textContent =
      currentCustomer.businessName || "Customer Admin Panel";

    $("subscriptionStatus").textContent = subscription.message;

    showDashboard();
    showMessage(dashboardMessage, "");
    await loadProducts();
    showSection("overview");

  } catch (error) {
    currentCustomer = null;
    currentUser = null;
    showLogin();
    showMessage(loginMessage, error.message || "Customer load nahi hua.");
  }
}

/* =====================================
   PRODUCTS
===================================== */

async function loadProducts() {
  if (!currentCustomer) return;

  const productsQuery = query(
    collection(db, "customerProducts"),
    where("customerId", "==", currentCustomer.id)
  );

  const snapshot = await getDocs(productsQuery);

  currentProducts = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));

  $("productCount").textContent = currentProducts.length;
}

function productFormHTML(product = {}) {
  const categories = [
    "CCTV Cameras",
    "IP Cameras",
    "DVR",
    "NVR",
    "Video Door Phones",
    "Accessories",
    "Other"
  ];

  const categoryOptions = categories.map((category) => `
    <option value="${escapeHTML(category)}"
      ${product.category === category ? "selected" : ""}>
      ${escapeHTML(category)}
    </option>
  `).join("");

  const features = Array.isArray(product.features)
    ? product.features.join("\n")
    : "";

  const specifications = product.specifications &&
    typeof product.specifications === "object"
      ? Object.entries(product.specifications)
      : [];

  return `
    <h2>${product.id ? "Edit Product" : "Add New Product"}</h2>

    <form id="productForm">
      <div class="grid">
        <div>
          <label>Product Name *</label>
          <input id="productName" required
            value="${escapeHTML(product.name || "")}"
            placeholder="Example: CP Plus 3MP Camera">
        </div>

        <div>
          <label>Category *</label>
          <select id="productCategory" required>
            <option value="">Select Category</option>
            ${categoryOptions}
          </select>
        </div>

        <div>
          <label>Model Number</label>
          <input id="productModel"
            value="${escapeHTML(product.model || "")}"
            placeholder="Enter model number">
        </div>

        <div>
          <label>Price (₹)</label>
          <input id="productPrice" type="number" min="0" step="0.01"
            value="${escapeHTML(product.price ?? "")}"
            placeholder="Enter price">
        </div>

        <div class="full">
          <label>Product Image URL</label>
          <input id="productImage"
            value="${escapeHTML(product.imageUrl || "")}"
            placeholder="Paste GitHub-hosted image URL">
        </div>

        <div class="full">
          <label>Description</label>
          <textarea id="productDescription"
            placeholder="Product description">${escapeHTML(product.description || "")}</textarea>
        </div>

        <div class="full">
          <label>Features (one feature per line)</label>
          <textarea id="productFeatures"
            placeholder="Full HD recording&#10;Night vision&#10;Motion detection">${escapeHTML(features)}</textarea>
        </div>

        <div class="full">
          <label>Specifications (one per line: Name: Value)</label>
          <textarea id="productSpecifications"
            placeholder="Resolution: 3MP&#10;Night Vision: Yes&#10;Warranty: 1 Year">${escapeHTML(
              specifications.map(([key, value]) => `${key}: ${value}`).join("\n")
            )}</textarea>
        </div>
      </div>

      <div class="checkbox-row">
        <label><input type="checkbox" id="productNew"
          ${product.isNew ? "checked" : ""}> New Product</label>

        <label><input type="checkbox" id="productTrending"
          ${product.trending ? "checked" : ""}> Trending</label>

        <label><input type="checkbox" id="productActive"
          ${product.active !== false ? "checked" : ""}> Active</label>
      </div>

      <button class="primary" type="submit">
        ${product.id ? "Update Product" : "Save Product"}
      </button>

      <button class="secondary" type="button" id="cancelProduct">
        Cancel
      </button>
    </form>
  `;
}

function parseSpecifications(value) {
  const result = {};

  value.split("\n").forEach((line) => {
    const separator = line.indexOf(":");

    if (separator < 1) return;

    const key = line.slice(0, separator).trim();
    const val = line.slice(separator + 1).trim();

    if (key && val) result[key] = val;
  });

  return result;
}

async function saveProduct(event) {
  event.preventDefault();

  if (!currentCustomer || !currentUser) {
    showMessage(dashboardMessage, "Customer login required.");
    return;
  }

  const name = $("productName").value.trim();
  const category = $("productCategory").value;
  const priceValue = $("productPrice").value.trim();

  if (!name || !category) {
    showMessage(dashboardMessage, "Product name aur category required hain.");
    return;
  }

  const price = priceValue === "" ? null : Number(priceValue);

  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    showMessage(dashboardMessage, "Please valid price enter kijiye.");
    return;
  }

  const features = $("productFeatures").value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  const productData = {
    customerId: currentCustomer.id,
    customerUid: currentUser.uid,
    name,
    category,
    model: $("productModel").value.trim(),
    price,
    imageUrl: $("productImage").value.trim(),
    description: $("productDescription").value.trim(),
    features,
    specifications: parseSpecifications(
      $("productSpecifications").value
    ),
    isNew: $("productNew").checked,
    trending: $("productTrending").checked,
    active: $("productActive").checked,
    updatedAt: serverTimestamp()
  };

  try {
    showMessage(dashboardMessage, "Saving product...");

    if (editingProductId) {
      const existing = currentProducts.find(
        (item) => item.id === editingProductId
      );

      if (!existing || existing.customerId !== currentCustomer.id) {
        throw new Error("Aap is product ko edit nahi kar sakte.");
      }

      await updateDoc(
        doc(db, "customerProducts", editingProductId),
        productData
      );
    } else {
      productData.createdAt = serverTimestamp();

      await addDoc(
        collection(db, "customerProducts"),
        productData
      );
    }

    editingProductId = null;

    await loadProducts();
    showMessage(dashboardMessage, "Product successfully saved.", true);
    showProducts();

  } catch (error) {
    showMessage(
      dashboardMessage,
      error.message || "Product save nahi hua."
    );
  }
}

async function deleteProduct(productId) {
  if (!currentCustomer) return;

  const product = currentProducts.find(
    (item) => item.id === productId
  );

  if (!product || product.customerId !== currentCustomer.id) {
    showMessage(dashboardMessage, "Aap is product ko delete nahi kar sakte.");
    return;
  }

  if (!confirm("Kya aap ye product delete karna chahte hain?")) {
    return;
  }

  try {
    await deleteDoc(doc(db, "customerProducts", productId));

    await loadProducts();
    showMessage(dashboardMessage, "Product deleted successfully.", true);
    showProducts();

  } catch (error) {
    showMessage(dashboardMessage, error.message || "Delete failed.");
  }
}

function showProducts() {
  const productCards = currentProducts.map((product) => `
    <article class="product">
      ${product.imageUrl
        ? `<img src="${escapeHTML(product.imageUrl)}"
             alt="${escapeHTML(product.name)}"
             onerror="this.style.display='none'">`
        : ""
      }

      <h3>${escapeHTML(product.name)}</h3>
      <p><b>Category:</b> ${escapeHTML(product.category)}</p>
      <p><b>Model:</b> ${escapeHTML(product.model || "-")}</p>
      <p><b>Price:</b> ${
        product.price === null || product.price === undefined
          ? "Not set"
          : "₹" + escapeHTML(product.price)
      }</p>
      <p><b>Status:</b> ${product.active === false ? "Inactive" : "Active"}</p>

      <button class="primary" data-edit="${escapeHTML(product.id)}">
        Edit
      </button>

      <button class="danger" data-delete="${escapeHTML(product.id)}">
        Delete
      </button>
    </article>
  `).join("");

  sectionContent.innerHTML = `
    <h2>My Products</h2>
    <p class="muted">Add and manage your business products.</p>

    <div>
      <button class="primary" id="addProductBtn">+ Add Product</button>
    </div>

    <div id="productFormArea"></div>

    <div class="product-list">
      ${productCards || "<p>No products added yet.</p>"}
    </div>
  `;

  $("addProductBtn").addEventListener("click", () => {
    editingProductId = null;
    $("productFormArea").innerHTML = productFormHTML();
    attachProductFormEvents();
  });

  sectionContent.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const product = currentProducts.find(
        (item) => item.id === button.dataset.edit
      );

      if (!product) return;

      editingProductId = product.id;
      $("productFormArea").innerHTML = productFormHTML(product);
      attachProductFormEvents();

      $("productFormArea").scrollIntoView({ behavior: "smooth" });
    });
  });

  sectionContent.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteProduct(button.dataset.delete);
    });
  });
}

function attachProductFormEvents() {
  $("productForm").addEventListener("submit", saveProduct);

  $("cancelProduct").addEventListener("click", () => {
    editingProductId = null;
    $("productFormArea").innerHTML = "";
  });
}

/* =====================================
   DASHBOARD SECTIONS
===================================== */

async function showSection(section) {
  document.querySelectorAll("[data-section]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.section === section
    );
  });

  if (section === "overview") {
    sectionContent.innerHTML = `
      <h2>Overview</h2>
      <p>Welcome to your RB Tech Solution Customer Admin Panel.</p>
      <p>Total products: <b>${currentProducts.length}</b></p>
      <p>Subscription: <b>${escapeHTML($("subscriptionStatus").textContent)}</b></p>
    `;
    return;
  }

  if (section === "products") {
    try {
      await loadProducts();
      showProducts();
    } catch (error) {
      showMessage(dashboardMessage, error.message || "Products load nahi hue.");
    }
    return;
  }

  if (section === "enquiries") {
    sectionContent.innerHTML = `
      <h2>Customer Enquiries</h2>
      <p>Enquiries section abhi aapke Firestore enquiry collection ke structure se connect nahi hai.</p>
    `;
    return;
  }

  if (section === "subscription") {
    const expiry = currentCustomer?.subscriptionExpiry;
    let expiryText = "Not available";

    if (expiry) {
      const date = typeof expiry.toDate === "function"
        ? expiry.toDate()
        : new Date(expiry);

      expiryText = Number.isNaN(date.getTime())
        ? "Invalid date"
        : date.toLocaleDateString("en-IN");
    }

    sectionContent.innerHTML = `
      <h2>Subscription Details</h2>
      <p><b>Status:</b> ${escapeHTML($("subscriptionStatus").textContent)}</p>
      <p><b>Expiry Date:</b> ${escapeHTML(expiryText)}</p>
      <p class="muted">Subscription renewal ke liye RB Tech Solution Admin se contact kijiye.</p>
    `;
  }
}

/* =====================================
   LOGIN / LOGOUT
===================================== */

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  showMessage(loginMessage, "Logging in...");

  const email = $("email").value.trim();
  const password = $("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showMessage(loginMessage, "");
  } catch (error) {
    showMessage(loginMessage, error.message || "Login failed.");
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    currentCustomer = null;
    currentProducts = [];
    currentUser = null;
    showLogin();
    showMessage(loginMessage, "You have logged out.", true);
  } catch (error) {
    showMessage(dashboardMessage, error.message || "Logout failed.");
  }
});

document.querySelectorAll("[data-section]").forEach((button) => {
  button.addEventListener("click", () => {
    showSection(button.dataset.section);
  });
});

/* =====================================
   AUTH INITIALIZATION
===================================== */

async function initializeCustomerAdmin() {
  try {
    await authReady;

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        currentUser = null;
        currentCustomer = null;
        currentProducts = [];
        showLogin();
        return;
      }

      await loadCustomer(user);
    });

  } catch (error) {
    showLogin();
    showMessage(
      loginMessage,
      error.message || "Firebase initialization failed."
    );
  }
}

initializeCustomerAdmin();
