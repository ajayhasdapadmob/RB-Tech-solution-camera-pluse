
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

// ========================================
// PRODUCT CATEGORIES AND SPECIFICATIONS
// ========================================

const PRODUCT_CATEGORIES = [
  "CCTV Cameras",
  "Wireless Cameras",
  "IP Cameras",
  "PTZ Cameras",
  "DVR & NVR",
  "Video Door Phone",
  "Biometric Systems",
  "Networking",
  "Storage",
  "Accessories"
];

const STANDARD_SPECIFICATIONS = [
  "Angle of View",
  "Image sensor",
  "Lens",
  "Aperture",
  "Compression",
  "Video Format",
  "Video resolution",
  "Smart Features",
  "Record Type",
  "Parking Mode",
  "Mobile App",
  "Connectivity",
  "Microphone",
  "Speaker",
  "SD Card",
  "Photo Format",
  "Housing Type",
  "Power Source",
  "Working temperature",
  "Storage temperature",
  "Size",
  "Certificates"
];

// ========================================
// ELEMENTS
// ========================================

const $ = id => document.getElementById(id);

const loginSection = $("loginSection");
const dashboardSection = $("dashboardSection");
const loginForm = $("customerLoginForm");
const loginMessage = $("loginMessage");
const dashboardMessage = $("dashboardMessage");
const logoutBtn = $("logoutBtn");

const emailInput = $("email");
const passwordInput = $("password");

const customerName = $("customerName");
const businessTitle = $("businessTitle");
const subscriptionStatus = $("subscriptionStatus");
const sectionContent = $("sectionContent");

let currentCustomer = null;
let editingProductId = null;

// ========================================
// MESSAGES
// ========================================

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

// ========================================
// SCREEN CONTROL
// ========================================

function showLogin() {
  if (loginSection) loginSection.hidden = false;
  if (dashboardSection) dashboardSection.hidden = true;
  if (logoutBtn) logoutBtn.hidden = true;

  currentCustomer = null;
  editingProductId = null;
}

function showDashboard() {
  if (loginSection) loginSection.hidden = true;
  if (dashboardSection) dashboardSection.hidden = false;
  if (logoutBtn) logoutBtn.hidden = false;
}

// ========================================
// HELPERS
// ========================================

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function normalizeFeatures(value) {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    return value.split("\n").map(item => item.trim()).filter(Boolean);
  }

  return [];
}

function normalizeSpecifications(value) {
  if (Array.isArray(value)) {
    const result = {};

    value.forEach(item => {
      const key = item.name || item.key || "";

      if (key) result[key] = item.value || "";
    });

    return result;
  }

  if (value && typeof value === "object") return value;

  if (typeof value === "string" && value.trim()) {
    const result = {};

    value.split("\n").forEach(line => {
      const index = line.indexOf(":");

      if (index > -1) {
        result[line.slice(0, index).trim()] =
          line.slice(index + 1).trim();
      }
    });

    return result;
  }

  return {};
}

// ========================================
// CUSTOMER VERIFICATION
// ========================================

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

  if (Date.now() >= expiryDate.getTime()) {
    throw new Error(
      "Your subscription has expired. Please contact RB Tech Solution for renewal."
    );
  }

  return true;
}

async function loadCustomer(user) {
  const customer = await getCustomerByUid(user.uid);

  if (customer.uid !== user.uid) {
    throw new Error("Customer account verification failed.");
  }

  checkSubscription(customer);

  currentCustomer = customer;

  if (customerName) {
    customerName.textContent = customer.businessName || "Customer";
  }

  if (businessTitle) {
    businessTitle.textContent =
      customer.businessName || "Customer Admin Panel";
  }

  if (subscriptionStatus) {
    subscriptionStatus.textContent = "Active";
  }

  showDashboard();

  showDashboardMessage("Customer account verified successfully.");

  await showSection("overview");
}

// ========================================
// CUSTOMER PRODUCT COLLECTION
// ========================================

function getProductsCollection() {
  return collection(db, "customerProducts");
}

async function loadProducts() {
  if (!currentCustomer) return [];

  checkSubscription(currentCustomer);

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

// ========================================
// PRODUCT FORM STYLES
// ========================================

function addProductFormStyles() {
  if ($("customerProductFormStyles")) return;

  const style = document.createElement("style");
  style.id = "customerProductFormStyles";

  style.textContent = `
    .customer-product-form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      margin-top: 18px;
    }

    .customer-product-form .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .customer-product-form label {
      font-weight: 600;
      font-size: 14px;
    }

    .customer-product-form input,
    .customer-product-form select,
    .customer-product-form textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 11px;
      border: 1px solid #cbd5e1;
      border-radius: 7px;
      font: inherit;
      background: #fff;
      color: #0f172a;
    }

    .customer-product-form textarea {
      min-height: 90px;
      resize: vertical;
    }

    .customer-product-form .full-width {
      grid-column: 1 / -1;
    }

    .customer-product-form .form-subheading {
      grid-column: 1 / -1;
      margin: 14px 0 0;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }

    .customer-product-form .dynamic-row {
      display: flex;
      gap: 8px;
      margin: 8px 0;
    }

    .customer-product-form .dynamic-row input,
    .customer-product-form .spec-row input {
      flex: 1;
      min-width: 0;
    }

    .customer-product-form .spec-row {
      display: flex;
      gap: 8px;
      margin: 8px 0;
    }

    .customer-product-form .remove-row {
      background: #dc2626;
      color: #fff;
      border: 0;
      border-radius: 6px;
      padding: 8px 12px;
      cursor: pointer;
    }

    .customer-product-form .add-row {
      background: #e0f2fe;
      color: #075985;
      border: 0;
      border-radius: 6px;
      padding: 9px 12px;
      cursor: pointer;
      margin-top: 6px;
    }

    .customer-product-form .check-row {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 7px 0;
    }

    .customer-product-form .check-row input {
      width: auto;
    }

    .customer-product-form .form-actions {
      grid-column: 1 / -1;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 12px;
    }

    .customer-product-form button {
      cursor: pointer;
    }

    .customer-product-form .save-button {
      background: #087f3c;
      color: white;
      border: 0;
      padding: 12px 20px;
      border-radius: 7px;
    }

    .customer-product-form .cancel-button {
      background: #64748b;
      color: white;
      border: 0;
      padding: 12px 20px;
      border-radius: 7px;
    }

    .customer-product-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 15px;
      margin: 12px 0;
      background: white;
    }

    .customer-product-card img {
      width: 140px;
      height: 110px;
      object-fit: contain;
      display: block;
      margin-bottom: 10px;
    }

    .customer-product-card .product-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 12px;
    }

    .customer-product-card button {
      border: 0;
      border-radius: 6px;
      padding: 9px 14px;
      color: white;
      background: #2563eb;
    }

    .customer-product-card button.delete-button {
      background: #dc2626;
    }

    @media (max-width: 650px) {
      .customer-product-form {
        grid-template-columns: 1fr;
      }

      .customer-product-form .full-width,
      .customer-product-form .form-subheading,
      .customer-product-form .form-actions {
        grid-column: 1;
      }

      .customer-product-form .spec-row,
      .customer-product-form .dynamic-row {
        flex-wrap: wrap;
      }
    }
  `;

  document.head.appendChild(style);
}

// ========================================
// BUILD STANDARD SPECIFICATION FIELDS
// ========================================

function buildStandardSpecifications(values = {}) {
  const container = $("standardSpecifications");
  if (!container) return;

  container.innerHTML = "";

  STANDARD_SPECIFICATIONS.forEach((specName, index) => {
    const group = document.createElement("div");
    group.className = "form-group";

    const label = document.createElement("label");
    label.htmlFor = `standardSpec${index}`;
    label.textContent = specName;

    const input = document.createElement("input");
    input.type = "text";
    input.id = `standardSpec${index}`;
    input.className = "standard-spec-input";
    input.dataset.specName = specName;
    input.placeholder = `Enter ${specName}`;
    input.value = values[specName] ?? "";

    group.append(label, input);
    container.appendChild(group);
  });
}

// ========================================
// FEATURE INPUTS
// ========================================

function addFeatureRow(value = "") {
  const container = $("featuresFields");
  if (!container) return;

  const row = document.createElement("div");
  row.className = "dynamic-row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "feature-input";
  input.placeholder = "Enter product feature";
  input.value = value;

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "remove-row";
  removeBtn.textContent = "Remove";

  removeBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to remove this feature?")) {
      row.remove();
    }
  });

  row.append(input, removeBtn);
  container.appendChild(row);
}

function getProductFeatures() {
  return [...document.querySelectorAll(".feature-input")]
    .map(input => input.value.trim())
    .filter(Boolean);
}

// ========================================
// CUSTOM SPECIFICATION INPUTS
// ========================================

function addCustomSpecificationRow(key = "", value = "") {
  const container = $("customSpecifications");
  if (!container) return;

  const row = document.createElement("div");
  row.className = "spec-row";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "custom-spec-key";
  nameInput.placeholder = "Specification Name";
  nameInput.value = key;

  const valueInput = document.createElement("input");
  valueInput.type = "text";
  valueInput.className = "custom-spec-value";
  valueInput.placeholder = "Specification Value";
  valueInput.value = value;

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "remove-row";
  removeBtn.textContent = "Remove";

  removeBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to remove this specification?")) {
      row.remove();
    }
  });

  row.append(nameInput, valueInput, removeBtn);
  container.appendChild(row);
}

function getProductSpecifications() {
  const specifications = {};

  document.querySelectorAll(".standard-spec-input").forEach(input => {
    specifications[input.dataset.specName] = input.value.trim();
  });

  document.querySelectorAll(".spec-row").forEach(row => {
    const key = row.querySelector(".custom-spec-key").value.trim();
    const value = row.querySelector(".custom-spec-value").value.trim();

    if (key) specifications[key] = value;
  });

  return specifications;
}

// ========================================
// FILL FORM FIELDS FOR EDITING
// ========================================

function setProductDetailsFields(features = [], specifications = {}) {
  const featuresContainer = $("featuresFields");
  const customContainer = $("customSpecifications");

  if (!featuresContainer || !customContainer) return;

  const featureList = normalizeFeatures(features);
  const specValues = normalizeSpecifications(specifications);

  featuresContainer.innerHTML = "";
  customContainer.innerHTML = "";

  if (featureList.length) {
    featureList.forEach(feature => addFeatureRow(feature));
  } else {
    addFeatureRow();
  }

  buildStandardSpecifications(specValues);

  const standardNames = new Set(STANDARD_SPECIFICATIONS);

  const customEntries = Object.entries(specValues)
    .filter(([key]) => !standardNames.has(key));

  if (customEntries.length) {
    customEntries.forEach(([key, value]) => {
      addCustomSpecificationRow(key, value);
    });
  } else {
    addCustomSpecificationRow();
  }
}

// ========================================
// RENDER PRODUCT FORM
// ========================================

function renderProductForm(product = null) {
  if (!currentCustomer) return;

  checkSubscription(currentCustomer);
  addProductFormStyles();

  editingProductId = product ? product.id : null;

  const selectedCategory = product?.category || "";

  sectionContent.innerHTML = `
    <h2>${product ? "Edit Product" : "Add New Product"}</h2>

    <form id="customerProductForm" class="customer-product-form">

      <div class="form-group">
        <label for="productName">Product Name *</label>
        <input
          type="text"
          id="productName"
          required
          maxlength="100"
          value="${escapeHTML(product?.name || "")}"
          placeholder="Enter product name"
        >
      </div>

      <div class="form-group">
        <label for="productCategory">Category *</label>
        <select id="productCategory" required>
          <option value="">Select Category</option>
          ${PRODUCT_CATEGORIES.map(category => `
            <option
              value="${escapeHTML(category)}"
              ${selectedCategory === category ? "selected" : ""}
            >${escapeHTML(category)}</option>
          `).join("")}
        </select>
      </div>

      <div class="form-group">
        <label for="productModel">Model Number</label>
        <input
          type="text"
          id="productModel"
          value="${escapeHTML(product?.model || "")}"
          placeholder="Enter model number"
        >
      </div>

      <div class="form-group">
        <label for="productPrice">Price (₹)</label>
        <input
          type="number"
          id="productPrice"
          min="0"
          step="0.01"
          value="${escapeHTML(product?.price ?? "")}"
          placeholder="Enter price"
        >
      </div>

      <div class="form-group full-width">
        <label for="productDescription">Product Description</label>
        <textarea
          id="productDescription"
          maxlength="5000"
          placeholder="Enter product description"
        >${escapeHTML(product?.description || "")}</textarea>
      </div>

      <div class="form-group full-width">
        <label for="productImage">Product Image URL (GitHub)</label>
        <input
          type="url"
          id="productImage"
          value="${escapeHTML(product?.imageUrl || product?.image || "")}"
          placeholder="https://example.com/image.jpg"
        >
        <small>GitHub पर upload की गई image का पूरा URL डालें।</small>
      </div>

      <h3 class="form-subheading">Product Features</h3>

      <div class="form-group full-width">
        <div id="featuresFields"></div>
        <button type="button" id="addFeatureBtn" class="add-row">
          + Add Feature
        </button>
      </div>

      <h3 class="form-subheading">Product Specifications</h3>

      <div id="standardSpecifications"
        class="full-width"
        style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px">
      </div>

      <h3 class="form-subheading">Additional Specifications</h3>

      <div class="form-group full-width">
        <div id="customSpecifications"></div>
        <button type="button" id="addSpecificationBtn" class="add-row">
          + Add Specification
        </button>
      </div>

      <div class="form-group full-width">
        <label for="productNote">Additional Note</label>
        <textarea
          id="productNote"
          maxlength="3000"
          placeholder="Enter additional note"
        >${escapeHTML(product?.note || product?.notes || "")}</textarea>
      </div>

      <div class="form-group full-width">
        <label class="check-row">
          <input type="checkbox" id="productIsNew"
            ${product?.isNew === true ? "checked" : ""}>
          Show NEW Badge
        </label>

        <label class="check-row">
          <input type="checkbox" id="productTrending"
            ${
              product?.trending === true ||
              product?.isTrending === true ||
              product?.featured === true ? "checked" : ""
            }>
          Show in Trending Products
        </label>

        <label class="check-row">
          <input type="checkbox" id="productActive"
            ${product?.active !== false ? "checked" : ""}>
          Active Product
        </label>
      </div>

      <div class="form-actions">
        <button type="submit" id="saveProductBtn" class="save-button">
          ${product ? "Update Product" : "Save Product"}
        </button>

        <button type="button" id="clearProductBtn" class="cancel-button">
          Clear Form
        </button>

        <button type="button" id="cancelProductBtn" class="cancel-button">
          Back to Products
        </button>
      </div>

      <p id="customerProductMessage" class="full-width"></p>

    </form>
  `;

  setProductDetailsFields(
    product?.features || [],
    product?.specifications || {}
  );

  $("addFeatureBtn").addEventListener("click", () => addFeatureRow());

  $("addSpecificationBtn").addEventListener("click", () => {
    addCustomSpecificationRow();
  });

  $("clearProductBtn").addEventListener("click", () => {
    renderProductForm();
  });

  $("cancelProductBtn").addEventListener("click", () => {
    showSection("products");
  });

  $("customerProductForm").addEventListener("submit", saveProduct);
}

// ========================================
// SAVE OR UPDATE PRODUCT
// ========================================

async function saveProduct(event) {
  event.preventDefault();

  if (!currentCustomer) return;

  const message = $("customerProductMessage");
  const saveButton = $("saveProductBtn");

  try {
    checkSubscription(currentCustomer);

    const name = $("productName").value.trim();
    const category = $("productCategory").value.trim();
    const priceText = $("productPrice").value.trim();
    const price = priceText === "" ? "" : Number(priceText);

    const description = $("productDescription").value.trim();
    const imageUrl = $("productImage").value.trim();
    const note = $("productNote").value.trim();

    if (!name || !category) {
      throw new Error("Product Name and Category are required.");
    }

    if (
      priceText !== "" &&
      (!Number.isFinite(price) || price < 0)
    ) {
      throw new Error("Please enter a valid product price.");
    }

    if (
      imageUrl &&
      !/^https?:\/\/\S+$/i.test(imageUrl)
    ) {
      throw new Error("Please enter a valid HTTP or HTTPS image URL.");
    }

    const trending = $("productTrending").checked;

    const productData = {
      customerId: currentCustomer.id,

      name,
      category,
      model: $("productModel").value.trim(),
      price,
      description,

      features: getProductFeatures(),
      specifications: getProductSpecifications(),

      note,

      isNew: $("productIsNew").checked,

      trending,
      isTrending: trending,
      featured: trending,

      active: $("productActive").checked,

      updatedAt: serverTimestamp()
    };

    if (imageUrl) {
      productData.imageUrl = imageUrl;
    } else {
      productData.imageUrl = "";
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    if (editingProductId) {
      const productRef = doc(
        db,
        "customerProducts",
        editingProductId
      );

      const existingProduct = await getDoc(productRef);

      if (
        !existingProduct.exists() ||
        existingProduct.data().customerId !== currentCustomer.id
      ) {
        throw new Error("You cannot edit this product.");
      }

      await updateDoc(productRef, productData);

      showDashboardMessage("Product updated successfully.");

    } else {
      productData.createdAt = serverTimestamp();

      await addDoc(
        getProductsCollection(),
        productData
      );

      showDashboardMessage("Product added successfully.");
    }

    editingProductId = null;

    await showSection("products");

  } catch (error) {
    console.error("Save product error:", error);

    if (message) {
      message.textContent = error.message || "Unable to save product.";
      message.style.color = "#dc2626";
    }

    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = editingProductId
        ? "Update Product"
        : "Save Product";
    }
  }
}

// ========================================
// DELETE PRODUCT
// ========================================

async function removeProduct(productId) {
  if (!currentCustomer) return;

  if (!confirm("Are you sure you want to permanently delete this product?")) {
    return;
  }

  try {
    checkSubscription(currentCustomer);

    const productRef = doc(db, "customerProducts", productId);
    const productSnapshot = await getDoc(productRef);

    if (
      !productSnapshot.exists() ||
      productSnapshot.data().customerId !== currentCustomer.id
    ) {
      throw new Error("You cannot delete this product.");
    }

    await deleteDoc(productRef);

    showDashboardMessage("Product deleted successfully.");

    await showSection("products");

  } catch (error) {
    console.error("Delete product error:", error);

    alert(error.message || "Unable to delete product.");
  }
}

// ========================================
// SHOW CUSTOMER PRODUCTS
// ========================================

async function showProducts() {
  sectionContent.innerHTML = `
    <h2>Product Management</h2>
    <p>Loading your products...</p>
  `;

  try {
    const products = await loadProducts();

    const cards = products.map(product => {
      const trending =
        product.trending === true ||
        product.isTrending === true ||
        product.featured === true;

      const badges = [];

      if (product.isNew === true) badges.push("NEW");
      if (trending) badges.push("TRENDING");

      badges.push(product.active === false ? "INACTIVE" : "ACTIVE");

      return `
        <article class="customer-product-card">

          ${
            product.imageUrl || product.image
              ? `<img
                  src="${escapeHTML(product.imageUrl || product.image)}"
                  alt="${escapeHTML(product.name)}"
                >`
              : ""
          }

          <h3>${escapeHTML(product.name || "Unnamed Product")}</h3>

          <p>Category: ${escapeHTML(product.category || "Not set")}</p>

          <p>Model: ${escapeHTML(product.model || "N/A")}</p>

          <p>Price: ${
            product.price === "" || product.price == null
              ? "Not set"
              : "₹" + Number(product.price).toLocaleString("en-IN")
          }</p>

          <p>${escapeHTML(product.description || "")}</p>

          <p><strong>${escapeHTML(badges.join(" • "))}</strong></p>

          <div class="product-actions">
            <button
              type="button"
              data-edit-product="${escapeHTML(product.id)}"
            >Edit</button>

            <button
              type="button"
              class="delete-button"
              data-delete-product="${escapeHTML(product.id)}"
            >Delete</button>
          </div>

        </article>
      `;
    }).join("");

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

    const productCount = $("productCount");

    if (productCount) {
      productCount.textContent = products.length;
    }

    $("addProductBtn").addEventListener("click", () => {
      renderProductForm();
    });

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

// ========================================
// DASHBOARD SECTIONS
// ========================================

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

    try {
      const products = await loadProducts();
      const productCount = $("productCount");

      if (productCount) {
        productCount.textContent = products.length;
      }
    } catch (error) {
      console.error("Overview product count error:", error);
    }
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

    const expiryText = expiry && typeof expiry.toDate === "function"
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

// ========================================
// SECTION BUTTONS
// ========================================

document.querySelectorAll("[data-section]").forEach(button => {
  button.addEventListener("click", () => {
    if (!currentCustomer) return;

    showSection(button.dataset.section);
  });
});

// ========================================
// CUSTOMER LOGIN
// ========================================

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

    if (submitButton) submitButton.disabled = true;

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

      if (submitButton) submitButton.disabled = false;
    }
  });
}

// ========================================
// LOGOUT
// ========================================

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

// ========================================
// AUTH STATE
// ========================================

async function initializeCustomerAdmin() {
  await authReady;

  onAuthStateChanged(auth, async user => {
    if (!user) {
      showLogin();
      return;
    }

    try {
      await loadCustomer(user);

      const submitButton =
        loginForm?.querySelector('button[type="submit"]');

      if (submitButton) submitButton.disabled = false;

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

// ========================================
// START
// ========================================

initializeCustomerAdmin().catch(error => {
  console.error("Customer Admin initialization error:", error);
  showLoginMessage("Unable to initialize Customer Admin.");
});
