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
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* =====================================
   RB TECH SOLUTION - CUSTOMER ADMIN
===================================== */

const $ = id => document.getElementById(id);

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
let currentEnquiries = [];
let editingProductId = null;
let authInitialized = false;

if ($("year")) {
  $("year").textContent = new Date().getFullYear();
}

/* =====================================
   COMMON HELPERS
===================================== */

function showMessage(element, message, success = false) {
  if (!element) return;

  element.textContent = message || "";
  element.className = success
    ? "message success"
    : "message";
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

function showLogin() {
  loginSection?.classList.remove("hidden");
  dashboardSection?.classList.add("hidden");
  logoutBtn?.classList.add("hidden");
}

function showDashboard() {
  loginSection?.classList.add("hidden");
  dashboardSection?.classList.remove("hidden");
  logoutBtn?.classList.remove("hidden");
}

function resetCustomerData() {
  currentUser = null;
  currentCustomer = null;
  currentProducts = [];
  currentEnquiries = [];
  editingProductId = null;
}

function ensureActiveSubscription() {
  if (!currentCustomer) {
    throw new Error("Customer login required.");
  }

  const result = checkSubscription(currentCustomer);

  if (!result.active) {
    throw new Error(
      `Subscription ${result.message}. Admin se contact kijiye.`
    );
  }
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
    throw new Error(
      "Customer account nahi mila. Admin se contact kijiye."
    );
  }

  const customerDoc = snapshot.docs[0];

  return {
    id: customerDoc.id,
    ...customerDoc.data()
  };
}

/* =====================================
   SUBSCRIPTION CHECK
===================================== */

function checkSubscription(customer) {
  if (
    String(customer.status || "").toLowerCase() !== "active"
  ) {
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

  const expiryDate =
    typeof expiry.toDate === "function"
      ? expiry.toDate()
      : new Date(expiry);

  if (Number.isNaN(expiryDate.getTime())) {
    return {
      active: false,
      message: "Invalid expiry date"
    };
  }

  if (expiryDate.getTime() <= Date.now()) {
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
  showMessage(
    loginMessage,
    "Customer account verify ho raha hai..."
  );

  try {
    const customer = await getCustomerByUid(user.uid);

    if (customer.uid !== user.uid) {
      throw new Error("Customer UID verification failed.");
    }

    const subscription = checkSubscription(customer);

    if (!subscription.active) {
      throw new Error(
        `Aapka subscription ${subscription.message} hai. Admin se contact kijiye.`
      );
    }

    currentUser = user;
    currentCustomer = customer;

    if ($("customerName")) {
      $("customerName").textContent =
        customer.businessName ||
        customer.ownerName ||
        user.email ||
        "Customer";
    }

    if ($("businessTitle")) {
      $("businessTitle").textContent =
        customer.businessName ||
        "Customer Admin Panel";
    }

    if ($("subscriptionStatus")) {
      $("subscriptionStatus").textContent = "Active";
    }

    showDashboard();

    showMessage(
      dashboardMessage,
      "Customer account verified successfully.",
      true
    );

    // Customer verification ke baad dashboard khulega.
    // Product/enquiry errors login ko logout nahi karenge.
    await showSection("overview");

    showMessage(loginMessage, "");

  } catch (error) {
    console.error("Customer verification error:", error);

    resetCustomerData();
    showLogin();

    showMessage(
      loginMessage,
      error.message || "Customer verification failed."
    );

    // Verification fail hone par hi sign out.
    if (auth.currentUser) {
      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error("Sign out error:", signOutError);
      }
    }
  }
}

/* =====================================
   LOAD CUSTOMER PRODUCTS
===================================== */

async function loadProducts() {
  if (!currentCustomer) return [];

  ensureActiveSubscription();

  const productsQuery = query(
    collection(db, "customerProducts"),
    where("customerId", "==", currentCustomer.id)
  );

  const snapshot = await getDocs(productsQuery);

  currentProducts = snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));

  if ($("productCount")) {
    $("productCount").textContent = currentProducts.length;
  }

  return currentProducts;
}

/* =====================================
   LOAD CUSTOMER ENQUIRIES
===================================== */

// IMPORTANT:
// Customer access ke liye customerEnquiries collection use ki gayi hai.
// Firestore rules mein bhi is collection par customer read access hona chahiye.

async function loadCustomerEnquiries() {
  if (!currentCustomer) return [];
  
  ensureActiveSubscription();
  
  const enquiriesQuery = query(
    collection(db, "enquiries"),
    where("customerId", "==", currentCustomer.id),
    limit(100)
  );
  
  const snapshot = await getDocs(enquiriesQuery);
  
  currentEnquiries = snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));
  
  currentEnquiries.sort((a, b) => {
    const dateA = a.createdAt?.toDate ?
      a.createdAt.toDate().getTime() :
      0;
    
    const dateB = b.createdAt?.toDate ?
      b.createdAt.toDate().getTime() :
      0;
    
    return dateB - dateA;
  });
  
  return currentEnquiries;
}

/* =====================================
   DASHBOARD COUNTS
===================================== */

async function updateDashboardCounts() {
  if ($("productCount")) {
    $("productCount").textContent = currentProducts.length;
  }

  if ($("enquiryCount")) {
    $("enquiryCount").textContent = currentEnquiries.length;
  }
}

/* =====================================
   PRODUCT FORM
===================================== */

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

  const categoryOptions = categories.map(category => `
    <option value="${escapeHTML(category)}"
      ${product.category === category ? "selected" : ""}>
      ${escapeHTML(category)}
    </option>
  `).join("");

  const features = Array.isArray(product.features)
    ? product.features.join("\n")
    : "";

  const specifications =
    product.specifications &&
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
            value="${escapeHTML(product.model || "")}">
        </div>

        <div>
          <label>Price (₹)</label>
          <input id="productPrice" type="number"
            min="0" step="0.01"
            value="${escapeHTML(product.price ?? "")}">
        </div>

        <div>
          <label>Product Image URL</label>
          <input id="productImage"
            value="${escapeHTML(product.imageUrl || "")}"
            placeholder="Paste GitHub image URL">
        </div>

        <div>
          <label>Description</label>
          <textarea id="productDescription">${escapeHTML(product.description || "")}</textarea>
        </div>

        <div>
          <label>Features (one per line)</label>
          <textarea id="productFeatures">${escapeHTML(features)}</textarea>
        </div>

        <div>
          <label>Specifications (Name: Value)</label>
          <textarea id="productSpecifications">${escapeHTML(
            specifications.map(([key, value]) => `${key}: ${value}`).join("\n")
          )}</textarea>
        </div>

      </div>

      <div class="checkbox-row">
        <label>
          <input type="checkbox" id="productNew"
            ${product.isNew ? "checked" : ""}>
          New Product
        </label>

        <label>
          <input type="checkbox" id="productTrending"
            ${product.trending ? "checked" : ""}>
          Trending
        </label>

        <label>
          <input type="checkbox" id="productActive"
            ${product.active !== false ? "checked" : ""}>
          Active
        </label>
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

/* =====================================
   PARSE SPECIFICATIONS
===================================== */

function parseSpecifications(value) {
  const result = {};

  value.split("\n").forEach(line => {
    const separator = line.indexOf(":");

    if (separator < 1) return;

    const key = line.slice(0, separator).trim();
    const val = line.slice(separator + 1).trim();

    if (key && val) result[key] = val;
  });

  return result;
}

/* =====================================
   SAVE PRODUCT
===================================== */

async function saveProduct(event) {
  event.preventDefault();

  if (!currentCustomer || !currentUser) {
    showMessage(dashboardMessage, "Customer login required.");
    return;
  }

  try {
    ensureActiveSubscription();

    const name = $("productName").value.trim();
    const category = $("productCategory").value;
    const priceValue = $("productPrice").value.trim();

    if (!name || !category) {
      throw new Error("Product name aur category required hain.");
    }

    const price = priceValue === ""
      ? null
      : Number(priceValue);

    if (
      price !== null &&
      (!Number.isFinite(price) || price < 0)
    ) {
      throw new Error("Please valid price enter kijiye.");
    }

    const features = $("productFeatures").value
      .split("\n")
      .map(item => item.trim())
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

    showMessage(dashboardMessage, "Saving product...");

    if (editingProductId) {
      const existing = currentProducts.find(
        item => item.id === editingProductId
      );

      if (
        !existing ||
        existing.customerId !== currentCustomer.id
      ) {
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
    await updateDashboardCounts();

    showMessage(
      dashboardMessage,
      "Product successfully saved.",
      true
    );

    showProducts();

  } catch (error) {
    console.error("Product save error:", error);

    showMessage(
      dashboardMessage,
      error.message || "Product save nahi hua."
    );
  }
}

/* =====================================
   DELETE PRODUCT
===================================== */

async function deleteProduct(productId) {
  if (!currentCustomer) return;

  try {
    ensureActiveSubscription();

    const product = currentProducts.find(
      item => item.id === productId
    );

    if (
      !product ||
      product.customerId !== currentCustomer.id
    ) {
      throw new Error("Aap is product ko delete nahi kar sakte.");
    }

    if (!confirm("Kya aap ye product delete karna chahte hain?")) {
      return;
    }

    await deleteDoc(
      doc(db, "customerProducts", productId)
    );

    await loadProducts();
    await updateDashboardCounts();

    showMessage(
      dashboardMessage,
      "Product deleted successfully.",
      true
    );

    showProducts();

  } catch (error) {
    console.error("Product delete error:", error);

    showMessage(
      dashboardMessage,
      error.message || "Delete failed."
    );
  }
}

/* =====================================
   SHOW PRODUCTS
===================================== */

function showProducts() {
  const productCards = currentProducts.map(product => `
    <article class="product">

      ${product.imageUrl ? `
        <img src="${escapeHTML(product.imageUrl)}"
          alt="${escapeHTML(product.name)}"
          onerror="this.style.display='none'">
      ` : ""}

      <h3>${escapeHTML(product.name)}</h3>

      <p><b>Category:</b> ${escapeHTML(product.category)}</p>
      <p><b>Model:</b> ${escapeHTML(product.model || "-")}</p>

      <p><b>Price:</b> ${
        product.price === null || product.price === undefined
          ? "Not set"
          : "₹" + escapeHTML(product.price)
      }</p>

      <p><b>Status:</b> ${
        product.active === false ? "Inactive" : "Active"
      }</p>

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

    <button class="primary" id="addProductBtn">
      + Add Product
    </button>

    <div id="productFormArea"></div>

    <div class="product-list">
      ${productCards || "<p>No products added yet.</p>"}
    </div>
  `;

  $("addProductBtn")?.addEventListener("click", () => {
    editingProductId = null;
    $("productFormArea").innerHTML = productFormHTML();
    attachProductFormEvents();
  });

  sectionContent.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => {
      const product = currentProducts.find(
        item => item.id === button.dataset.edit
      );

      if (!product) return;

      editingProductId = product.id;
      $("productFormArea").innerHTML = productFormHTML(product);
      attachProductFormEvents();

      $("productFormArea").scrollIntoView({
        behavior: "smooth"
      });
    });
  });

  sectionContent.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => {
      deleteProduct(button.dataset.delete);
    });
  });
}

function attachProductFormEvents() {
  $("productForm")?.addEventListener("submit", saveProduct);

  $("cancelProduct")?.addEventListener("click", () => {
    editingProductId = null;
    $("productFormArea").innerHTML = "";
  });
}

/* =====================================
   ENQUIRY HELPERS
===================================== */

function formatEnquiryDate(timestamp) {
  if (!timestamp) return "Not available";

  const date = typeof timestamp.toDate === "function"
    ? timestamp.toDate()
    : new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString("en-IN");
}

/* =====================================
   MARK ENQUIRY AS READ
===================================== */

async function markEnquiryAsRead(enquiryId) {
  if (!currentCustomer) return;

  try {
    ensureActiveSubscription();

    const enquiry = currentEnquiries.find(
      item => item.id === enquiryId
    );

    if (
      !enquiry ||
      enquiry.customerId !== currentCustomer.id
    ) {
      throw new Error("Aap is enquiry ko access nahi kar sakte.");
    }

    await updateDoc(
      doc(db, "enquiries", enquiryId),
      {
        read: true,
        updatedAt: serverTimestamp()
      }
    );

    await loadCustomerEnquiries();
    await updateDashboardCounts();
    showEnquiries();

    showMessage(
      dashboardMessage,
      "Enquiry marked as read.",
      true
    );

  } catch (error) {
    console.error("Mark enquiry error:", error);

    showMessage(
      dashboardMessage,
      error.message || "Unable to update enquiry."
    );
  }
}

/* =====================================
   SHOW CUSTOMER ENQUIRIES
===================================== */

function showEnquiries() {
  const enquiryCards = currentEnquiries.map(enquiry => {
    return `
      <article class="product enquiry-card">

        <h3>${escapeHTML(
          enquiry.productName ||
          enquiry.product ||
          "General Enquiry"
        )}</h3>

        <p><b>Customer:</b> ${escapeHTML(enquiry.name || "Not provided")}</p>
        <p><b>Email:</b> ${escapeHTML(enquiry.email || "Not provided")}</p>
        <p><b>Phone:</b> ${escapeHTML(enquiry.mobile || enquiry.phone || "Not provided")}</p>
        <p><b>Company:</b> ${escapeHTML(enquiry.company || "-")}</p>

        <p><b>Location:</b> ${escapeHTML([
          enquiry.city,
          enquiry.state,
          enquiry.country
        ].filter(Boolean).join(", ") || "-")}</p>

        <p><b>Pincode:</b> ${escapeHTML(enquiry.pincode || "-")}</p>
        <p><b>Model:</b> ${escapeHTML(enquiry.productModel || "-")}</p>
        <p><b>Message:</b> ${escapeHTML(enquiry.message || "No message")}</p>
        <p><b>Received:</b> ${escapeHTML(formatEnquiryDate(enquiry.createdAt))}</p>
        <p><b>Status:</b> ${escapeHTML(enquiry.status || "new")}</p>
        <p><b>Read:</b> ${enquiry.read === true ? "Yes" : "No"}</p>

        ${
          enquiry.read === true
            ? `<button class="secondary" disabled>Already Read</button>`
            : `
              <button class="primary"
                type="button"
                data-enquiry-read="${escapeHTML(enquiry.id)}">
                Mark as Read
              </button>
            `
        }

      </article>
    `;
  }).join("");

  sectionContent.innerHTML = `
    <h2>Customer Enquiries</h2>

    <p class="muted">
      Website par aapke products ke liye aayi enquiries yahan dikhengi.
    </p>

    <p><b>Total Enquiries:</b> ${currentEnquiries.length}</p>

    <button class="secondary" id="refreshEnquiriesBtn" type="button">
      Refresh Enquiries
    </button>

    <div class="product-list">
      ${enquiryCards || "<p>Abhi tak koi enquiry nahi aayi hai.</p>"}
    </div>
  `;

  $("refreshEnquiriesBtn")?.addEventListener("click", async () => {
    try {
      showMessage(
        dashboardMessage,
        "Enquiries refresh ho rahi hain..."
      );

      await loadCustomerEnquiries();
      await updateDashboardCounts();
      showEnquiries();

      showMessage(
        dashboardMessage,
        "Enquiries refreshed.",
        true
      );

    } catch (error) {
      console.error("Enquiry refresh error:", error);

      showMessage(
        dashboardMessage,
        error.message || "Enquiries refresh nahi hui."
      );
    }
  });

  sectionContent
    .querySelectorAll("[data-enquiry-read]")
    .forEach(button => {
      button.addEventListener("click", () => {
        markEnquiryAsRead(button.dataset.enquiryRead);
      });
    });
}

/* =====================================
   DASHBOARD SECTIONS
===================================== */

async function showSection(section) {
  if (!currentCustomer || !sectionContent) return;

  document.querySelectorAll("[data-section]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.section === section
    );
  });

  if (section === "overview") {
    sectionContent.innerHTML = `
      <h2>Overview</h2>
      <p>Dashboard information load ho rahi hai...</p>
    `;

    try {
      ensureActiveSubscription();

      // Dono operations alag handle honge.
      // Ek fail hone par doosra data bhi display ho sakega.
      const results = await Promise.allSettled([
        loadProducts(),
        loadCustomerEnquiries()
      ]);

      const productResult = results[0];
      const enquiryResult = results[1];

      await updateDashboardCounts();

      sectionContent.innerHTML = `
        <h2>Overview</h2>
        <p>Welcome to your RB Tech Solution Customer Admin Panel.</p>

        <p>Total products: <b>${currentProducts.length}</b></p>
        <p>Total enquiries: <b>${currentEnquiries.length}</b></p>
        <p>Subscription: <b>Active</b></p>

        ${
          productResult.status === "rejected"
            ? `<p class="message">${escapeHTML(productResult.reason?.message || "Products load failed.")}</p>`
            : ""
        }

        ${
          enquiryResult.status === "rejected"
            ? `<p class="message">${escapeHTML(enquiryResult.reason?.message || "Enquiries load failed.")}</p>`
            : ""
        }
      `;

    } catch (error) {
      console.error("Overview error:", error);

      sectionContent.innerHTML = `
        <h2>Overview</h2>
        <p>${escapeHTML(error.message)}</p>
      `;
    }

    return;
  }

  if (section === "products") {
    sectionContent.innerHTML = `
      <h2>My Products</h2>
      <p>Products load ho rahe hain...</p>
    `;

    try {
      await loadProducts();
      await updateDashboardCounts();
      showProducts();

      showMessage(dashboardMessage, "");

    } catch (error) {
      console.error("Products loading error:", error);

      sectionContent.innerHTML = `
        <h2>My Products</h2>
        <p>${escapeHTML(error.message || "Products load nahi hue.")}</p>
      `;
    }

    return;
  }

  if (section === "enquiries") {
    sectionContent.innerHTML = `
      <h2>Customer Enquiries</h2>
      <p>Enquiries load ho rahi hain...</p>
    `;

    try {
      await loadCustomerEnquiries();
      await updateDashboardCounts();
      showEnquiries();

      showMessage(dashboardMessage, "");

    } catch (error) {
      console.error("Enquiries loading error:", error);

      sectionContent.innerHTML = `
        <h2>Customer Enquiries</h2>
        <p>${escapeHTML(error.message || "Enquiries load nahi hui.")}</p>
      `;
    }

    return;
  }

  if (section === "subscription") {
    const expiry = currentCustomer.subscriptionExpiry;

    const expiryDate = expiry
      ? (typeof expiry.toDate === "function"
          ? expiry.toDate()
          : new Date(expiry))
      : null;

    const expiryText =
      expiryDate && !Number.isNaN(expiryDate.getTime())
        ? expiryDate.toLocaleDateString("en-IN")
        : "Not available";

    sectionContent.innerHTML = `
      <h2>Subscription Details</h2>

      <p><b>Plan:</b> ${escapeHTML(currentCustomer.plan || "-")}</p>
      <p><b>Amount:</b> ₹${escapeHTML(currentCustomer.subscriptionAmount ?? "-")}</p>
      <p><b>Status:</b> Active</p>
      <p><b>Expiry Date:</b> ${escapeHTML(expiryText)}</p>

      <p class="muted">
        Subscription renewal ke liye RB Tech Solution Admin se contact kijiye.
      </p>
    `;
  }
}

/* =====================================
   SINGLE LOGIN HANDLER
===================================== */

loginForm?.addEventListener("submit", async event => {
  event.preventDefault();

  const email = $("email")?.value.trim() || "";
  const password = $("password")?.value || "";
  const submitButton = loginForm.querySelector(
    'button[type="submit"]'
  );

  if (!email || !password) {
    showMessage(loginMessage, "Email aur password enter kijiye.");
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Logging in...";
  }

  showMessage(loginMessage, "Connecting to Firebase...");

  try {
    await authReady;

    // Yahan loadCustomer() manually call nahi karna hai.
    // onAuthStateChanged login ke baad automatically call karega.
    await signInWithEmailAndPassword(auth, email, password);

    showMessage(
      loginMessage,
      "Login successful. Customer account verify ho raha hai...",
      true
    );

  } catch (error) {
    console.error("Login error:", error);

    const errorMessages = {
      "auth/invalid-email": "Invalid email address.",
      "auth/user-not-found": "Customer account not found.",
      "auth/wrong-password": "Incorrect password.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/user-disabled": "This account has been disabled.",
      "auth/too-many-requests": "Too many attempts. Please try again later.",
      "auth/network-request-failed": "Internet connection failed."
    };

    showMessage(
      loginMessage,
      errorMessages[error.code] ||
      error.message ||
      "Login failed."
    );

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Login";
    }
  }
});

/* =====================================
   LOGOUT
===================================== */

logoutBtn?.addEventListener("click", async () => {
  try {
    await signOut(auth);

    resetCustomerData();
    showLogin();

    showMessage(
      loginMessage,
      "You have logged out.",
      true
    );

  } catch (error) {
    console.error("Logout error:", error);

    showMessage(
      dashboardMessage,
      error.message || "Logout failed."
    );
  }
});

/* =====================================
   DASHBOARD MENU EVENTS
===================================== */

document.querySelectorAll("[data-section]").forEach(button => {
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

    onAuthStateChanged(auth, async user => {
      if (authInitialized) {
        // Auth observer har state change par chalega.
        // Same signed-in user ke duplicate load ko avoid karein.
      }

      authInitialized = true;

      if (!user) {
        resetCustomerData();
        showLogin();
        return;
      }

      // Har signed-in user ka customer verification yahin hoga.
      await loadCustomer(user);
    });

  } catch (error) {
    console.error("Firebase initialization error:", error);

    showLogin();

    showMessage(
      loginMessage,
      error.message || "Unable to initialize Firebase."
    );
  }
}

initializeCustomerAdmin();
