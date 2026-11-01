
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
let editingProductId = null;

// MESSAGES
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

// LOGIN SCREEN
function showLogin() {
  loginSection.hidden = false;
  dashboardSection.hidden = true;
  logoutBtn.hidden = true;
  currentCustomer = null;
}

// DASHBOARD SCREEN
function showDashboard() {
  loginSection.hidden = true;
  dashboardSection.hidden = false;
  logoutBtn.hidden = false;
}

// FIND CUSTOMER BY UID
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

// CHECK SUBSCRIPTION
function checkSubscription(customer) {
  if (customer.status !== "active") {
    throw new Error("Your Customer Account is inactive.");
  }

  if (
    !customer.subscriptionExpiry ||
    typeof customer.subscriptionExpiry.toDate !== "function"
  ) {
    throw new Error("Subscription expiry date is not set correctly.");
  }

  const expiryDate = customer.subscriptionExpiry.toDate();

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

  await showSection("overview");
}

// SAFE HTML
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

// PRODUCT COLLECTION
function getProductsCollection() {
  return collection(db, "customerProducts");
}

// LOAD CUSTOMER PRODUCTS
async function loadProducts() {
  if (!currentCustomer) return [];

  const productsQuery = query(
    getProductsCollection(),
    where("customerId", "==", currentCustomer.id)
  );

  const snapshot = await getDocs(productsQuery);

  return snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));
}

// PRODUCT FORM
function renderProductForm(product = null) {
  editingProductId = product ? product.id : null;

  sectionContent.innerHTML = `
    <h2>${product ? "Edit Product" : "Add New Product"}</h2>

    <form id="productForm">

      <label>Product Name</label>
      <input
        type="text"
        id="productName"
        required
        maxlength="100"
        value="${escapeHTML(product?.name || "")}"
        placeholder="Enter product name"
      >

      <label>Product Price (₹)</label>
      <input
        type="number"
        id="productPrice"
        required
        min="0"
        step="0.01"
        value="${escapeHTML(product?.price ?? "")}"
        placeholder="Enter price"
      >

      <label>Product Description</label>
      <textarea
        id="productDescription"
        maxlength="2000"
        placeholder="Enter product details"
      >${escapeHTML(product?.description || "")}</textarea>

      <label>Product Photo URL (GitHub Image Link)</label>
      <input
        type="url"
        id="productImage"
        value="${escapeHTML(product?.imageUrl || "")}"
        placeholder="https://example.com/image.jpg"
      >

      <button type="submit">
        ${product ? "Update Product" : "Save Product"}
      </button>

      <button type="button" id="cancelProductBtn">
        Cancel
      </button>

    </form>
  `;

  document
    .getElementById("cancelProductBtn")
    .addEventListener("click", () => showSection("products"));

  document
    .getElementById("productForm")
    .addEventListener("submit", saveProduct);
}

// SAVE OR UPDATE PRODUCT
async function saveProduct(event) {
  event.preventDefault();

  if (!currentCustomer) return;

  try {
    checkSubscription(currentCustomer);

    const name = document.getElementById("productName").value.trim();
    const price = Number(document.getElementById("productPrice").value);
    const description =
      document.getElementById("productDescription").value.trim();
    const imageUrl =
      document.getElementById("productImage").value.trim();

    if (!name || !Number.isFinite(price) || price < 0) {
      alert("Please enter a valid product name and price.");
      return;
    }

    if (imageUrl) {
      const imageIsValid =
        /^https?:\/\/\S+$/i.test(imageUrl);

      if (!imageIsValid) {
        alert("Please enter a valid HTTP or HTTPS image URL.");
        return;
      }
    }

    const productData = {
      customerId: currentCustomer.id,
      name,
      price,
      description,
      imageUrl,
      updatedAt: serverTimestamp()
    };

    if (editingProductId) {
      await updateDoc(
        doc(db, "customerProducts", editingProductId),
        productData
      );

      alert("Product updated successfully.");

    } else {
      productData.createdAt = serverTimestamp();

      await addDoc(
        getProductsCollection(),
        productData
      );

      alert("Product added successfully.");
    }

    editingProductId = null;
    await showSection("products");

  } catch (error) {
    console.error("Save product error:", error);
    alert("Unable to save product. Please check your connection and account access.");
  }
}

// DELETE PRODUCT
async function removeProduct(productId) {
  if (!currentCustomer) return;

  const confirmed = confirm(
    "Are you sure you want to delete this product?"
  );

  if (!confirmed) return;

  try {
    checkSubscription(currentCustomer);

    await deleteDoc(
      doc(db, "customerProducts", productId)
    );

    alert("Product deleted successfully.");

    await showSection("products");

  } catch (error) {
    console.error("Delete product error:", error);
    alert("Unable to delete product. Please try again.");
  }
}

// SHOW PRODUCTS
async function showProducts() {
  sectionContent.innerHTML = `
    <h2>Product Management</h2>
    <p>Loading your products...</p>
  `;

  try {
    const products = await loadProducts();

    const cards = products.map(product => `
      <article class="product-card">

        ${
          product.imageUrl
            ? `<img
                src="${escapeHTML(product.imageUrl)}"
                alt="${escapeHTML(product.name)}"
                style="width:160px;height:120px;object-fit:contain"
              >`
            : ""
        }

        <h3>${escapeHTML(product.name)}</h3>

        <p>Price: ₹${Number(product.price || 0).toLocaleString("en-IN")}</p>

        <p>${escapeHTML(product.description || "")}</p>

        <button
          type="button"
          data-edit-product="${escapeHTML(product.id)}"
        >
          Edit
        </button>

        <button
          type="button"
          data-delete-product="${escapeHTML(product.id)}"
        >
          Delete
        </button>

      </article>
    `).join("");

    sectionContent.innerHTML = `
      <h2>Product Management</h2>

      <button type="button" id="addProductBtn">
        + Add New Product
      </button>

      <p>Total Products: ${products.length}</p>

      <div class="products">
        ${
          cards ||
          "<p>No products added yet. Click Add New Product to begin.</p>"
        }
      </div>
    `;

    const productCount = document.getElementById("productCount");

    if (productCount) {
      productCount.textContent = products.length;
    }

    document
      .getElementById("addProductBtn")
      .addEventListener("click", () => renderProductForm());

    sectionContent
      .querySelectorAll("[data-edit-product]")
      .forEach(button => {
        button.addEventListener("click", () => {
          const product = products.find(
            item => item.id === button.dataset.editProduct
          );

          if (product) renderProductForm(product);
        });
      });

    sectionContent
      .querySelectorAll("[data-delete-product]")
      .forEach(button => {
        button.addEventListener("click", () => {
          removeProduct(button.dataset.deleteProduct);
        });
      });

  } catch (error) {
    console.error("Load products error:", error);

    sectionContent.innerHTML = `
      <h2>Product Management</h2>
      <p>Unable to load products. Please check your account access.</p>
    `;
  }
}

// DASHBOARD SECTIONS
async function showSection(section) {
  if (!sectionContent || !currentCustomer) return;

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
      <p>Business: ${escapeHTML(currentCustomer.businessName || "")}</p>
      <p>Website: /${escapeHTML(currentCustomer.slug || "")}/</p>
    `;
  }

  else if (section === "products") {
    await showProducts();
  }

  else if (section === "enquiries") {
    sectionContent.innerHTML = `
      <h2>Enquiries</h2>
      <p>Enquiry management will be connected in the next step.</p>
    `;
  }

  else if (section === "subscription") {
    const expiry = currentCustomer.subscriptionExpiry;

    const expiryText = expiry
      ? expiry.toDate().toLocaleDateString("en-IN")
      : "Not set";

    sectionContent.innerHTML = `
      <h2>Subscription Details</h2>
      <p>Plan: ${escapeHTML(currentCustomer.plan || "Not set")}</p>
      <p>Amount: ₹${Number(currentCustomer.subscriptionAmount || 0)}</p>
      <p>Expiry Date: ${escapeHTML(expiryText)}</p>
      <p>Status: ${escapeHTML(currentCustomer.status || "Unknown")}</p>
    `;
  }
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

      if (loginForm) loginForm.reset();

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
