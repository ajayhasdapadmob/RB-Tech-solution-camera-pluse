
import { auth, db, authReady } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ========================================
// ALL STANDARD SPECIFICATIONS
// ========================================

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
const loginForm = $("loginForm");
const adminEmail = $("adminEmail");
const adminPassword = $("adminPassword");
const loginMessage = $("loginMessage");
const logoutBtn = $("logoutBtn");
const adminMessage = $("adminMessage");

const productForm = $("productForm");
const productId = $("productId");
const productName = $("productName");
const productCategory = $("productCategory");
const productModel = $("productModel");
const productPrice = $("productPrice");
const productDescription = $("productDescription");
const productImage = $("productImage");
const productNote = $("productNote");

const productIsNew = $("productIsNew");
const productTrending = $("productTrending");
const productActive = $("productActive");

const featuresFields = $("featuresFields");
const standardSpecifications = $("standardSpecifications");
const customSpecifications = $("customSpecifications");

const addFeatureBtn = $("addFeatureBtn");
const addSpecificationBtn = $("addSpecificationBtn");
const cancelEditBtn = $("cancelEditBtn");

const productMessage = $("productMessage");
const adminProductList = $("adminProductList");
const saveProductBtn = $("saveProductBtn");
const formHeading = $("formHeading");

// ========================================
// HELPERS
// ========================================

function showMessage(element, message, isError = false) {
  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#dc2626" : "#087f3c";
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

function normalizeFeatures(value) {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    return value.split("\n").map(x => x.trim()).filter(Boolean);
  }

  return [];
}

function normalizeSpecifications(value) {
  if (Array.isArray(value)) {
    const result = {};

    value.forEach(item => {
      const key = item.name || item.key || "";

      if (key) {
        result[key] = item.value || "";
      }
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
// BUILD ALL 22 STANDARD SPECIFICATION BOXES
// ========================================

function buildStandardSpecifications(values = {}) {
  standardSpecifications.innerHTML = "";

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
    standardSpecifications.appendChild(group);
  });
}

// ========================================
// REMOVE CONFIRMATION
// ========================================

function confirmRemove(message) {
  return window.confirm(message);
}

// ========================================
// FEATURE INPUTS
// ========================================

function addFeatureRow(value = "") {
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
    if (!confirmRemove("Are you sure you want to remove this feature?")) {
      return;
    }

    row.remove();
  });

  row.append(input, removeBtn);
  featuresFields.appendChild(row);
}

addFeatureBtn.addEventListener("click", () => addFeatureRow());

function getProductFeatures() {
  return [...featuresFields.querySelectorAll(".feature-input")]
    .map(input => input.value.trim())
    .filter(Boolean);
}

// ========================================
// CUSTOM SPECIFICATION INPUTS
// ========================================

function addCustomSpecificationRow(key = "", value = "") {
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
    if (!confirmRemove("Are you sure you want to remove this specification?")) {
      return;
    }

    row.remove();
  });

  row.append(nameInput, valueInput, removeBtn);
  customSpecifications.appendChild(row);
}

addSpecificationBtn.addEventListener("click", () => {
  addCustomSpecificationRow();
});

// ========================================
// COLLECT SPECIFICATIONS
// ========================================

function getProductSpecifications() {
  const specifications = {};

  standardSpecifications
    .querySelectorAll(".standard-spec-input")
    .forEach(input => {
      specifications[input.dataset.specName] = input.value.trim();
    });

  customSpecifications.querySelectorAll(".spec-row").forEach(row => {
    const key = row.querySelector(".custom-spec-key").value.trim();
    const value = row.querySelector(".custom-spec-value").value.trim();

    if (key) {
      specifications[key] = value;
    }
  });

  return specifications;
}

// ========================================
// FILL ALL FIELDS DURING EDIT
// ========================================

function setProductDetailsFields(features = [], specifications = {}) {
  const featureList = normalizeFeatures(features);
  const specValues = normalizeSpecifications(specifications);

  featuresFields.innerHTML = "";
  customSpecifications.innerHTML = "";

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

// Initial fields
setProductDetailsFields();

// ========================================
// CLEAR FORM
// ========================================

function clearProductForm() {
  productForm.reset();
  productId.value = "";
  productActive.checked = true;

  setProductDetailsFields([], {});

  formHeading.textContent = "Add New Product";
  saveProductBtn.textContent = "Save Product";

  showMessage(productMessage, "");
}

cancelEditBtn.addEventListener("click", clearProductForm);

// ========================================
// ADMIN PERMISSION
// ========================================

async function checkAdminPermission(user) {
  if (!user) return false;

  try {
    const adminRef = doc(db, "admin", user.uid);
    const adminSnap = await getDoc(adminRef);

    return adminSnap.exists() &&
      adminSnap.data().Active === true;

  } catch (error) {
    console.error("Admin permission error:", error);
    return false;
  }
}

// ========================================
// LOGIN
// ========================================

loginForm.addEventListener("submit", async event => {
  event.preventDefault();

  showMessage(loginMessage, "Logging in...");

  try {
    await signInWithEmailAndPassword(
      auth,
      adminEmail.value.trim(),
      adminPassword.value
    );

    showMessage(loginMessage, "Login successful. Checking permission...");

  } catch (error) {
    console.error("Login error:", error);
    showMessage(loginMessage, error.message, true);
  }
});

// ========================================
// LOGOUT
// ========================================

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    clearProductForm();

  } catch (error) {
    console.error("Logout error:", error);
    showMessage(adminMessage, error.message, true);
  }
});

// ========================================
// AUTH STATE
// ========================================

onAuthStateChanged(auth, async user => {
  loginSection.classList.remove("hidden");
  dashboardSection.classList.add("hidden");

  if (!user) {
    showMessage(loginMessage, "");
    return;
  }

  showMessage(loginMessage, "Checking admin permission...");

  try {
    if (authReady) await authReady;

    const allowed = await checkAdminPermission(user);

    if (!allowed) {
      showMessage(
        loginMessage,
        "Access denied. This account is not an active admin.",
        true
      );

      await signOut(auth);
      return;
    }

    loginSection.classList.add("hidden");
    dashboardSection.classList.remove("hidden");

    showMessage(adminMessage, "Admin login successful.");

    await loadAdminProducts();

  } catch (error) {
    console.error("Authentication error:", error);

    showMessage(loginMessage, error.message, true);
    await signOut(auth);
  }
});

// ========================================
// SAVE PRODUCT
// ========================================

productForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!auth.currentUser) {
    showMessage(productMessage, "Please login first.", true);
    return;
  }

  const name = productName.value.trim();
  const category = productCategory.value.trim();

  if (!name || !category) {
    showMessage(
      productMessage,
      "Product Name and Category are required.",
      true
    );
    return;
  }

  const trending = productTrending.checked;

  const productData = {
    name,
    category,
    model: productModel.value.trim(),
    price: productPrice.value.trim(),
    description: productDescription.value.trim(),

    features: getProductFeatures(),
    specifications: getProductSpecifications(),

    note: productNote.value.trim(),

    isNew: productIsNew.checked,

    trending,
    isTrending: trending,
    featured: trending,

    active: productActive.checked,
    updatedAt: serverTimestamp()
  };

  const imageUrl = productImage.value.trim();

  if (imageUrl) {
    productData.imageUrl = imageUrl;
  }

  saveProductBtn.disabled = true;
  saveProductBtn.textContent = "Saving...";

  try {
    if (productId.value) {
      await updateDoc(
        doc(db, "products", productId.value),
        productData
      );

    } else {
      productData.createdAt = serverTimestamp();

      await addDoc(
        collection(db, "products"),
        productData
      );
    }

    clearProductForm();
    await loadAdminProducts();

    showMessage(productMessage, "Product saved successfully.");

  } catch (error) {
    console.error("Save product error:", error);
    showMessage(productMessage, error.message, true);

  } finally {
    saveProductBtn.disabled = false;
    saveProductBtn.textContent = productId.value
      ? "Update Product"
      : "Save Product";
  }
});

// ========================================
// LOAD PRODUCTS
// ========================================

async function loadAdminProducts() {
  adminProductList.textContent = "Loading products...";

  try {
    const snapshot = await getDocs(collection(db, "products"));

    adminProductList.innerHTML = "";

    if (snapshot.empty) {
      adminProductList.textContent = "No products added yet.";
      return;
    }

    snapshot.forEach(productDoc => {
      const product = productDoc.data();
      const id = productDoc.id;

      const item = document.createElement("div");
      item.className = "product-item";

      const info = document.createElement("div");

      const name = document.createElement("strong");
      name.textContent = product.name || "Unnamed Product";

      const details = document.createElement("p");
      details.textContent =
        `${product.category || "No Category"} | Model: ${product.model || "N/A"} | Price: ${product.price || "N/A"}`;

      const badges = document.createElement("p");
      const badgeList = [];

      if (product.isNew === true) badgeList.push("NEW");

      if (
        product.trending === true ||
        product.isTrending === true ||
        product.featured === true
      ) {
        badgeList.push("TRENDING");
      }

      badgeList.push(product.active === false ? "INACTIVE" : "ACTIVE");

      badges.textContent = badgeList.join(" • ");

      info.append(name, details, badges);

      const actions = document.createElement("div");
      actions.className = "product-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "blue";
      editBtn.textContent = "Edit";

      editBtn.addEventListener("click", () => {
        editProduct(id, product);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "danger";
      deleteBtn.textContent = "Delete";

      deleteBtn.addEventListener("click", () => {
        deleteProduct(id, product.name || "this product");
      });

      actions.append(editBtn, deleteBtn);

      item.append(info, actions);
      adminProductList.appendChild(item);
    });

  } catch (error) {
    console.error("Load products error:", error);

    adminProductList.textContent =
      "Could not load products: " + error.message;
  }
}

// ========================================
// EDIT PRODUCT
// ========================================

function editProduct(id, product) {
  productId.value = id;

  productName.value = product.name || "";
  productCategory.value = product.category || "";
  productModel.value = product.model || "";
  productPrice.value = product.price || "";
  productDescription.value = product.description || "";

  productImage.value = product.imageUrl || product.image || "";
  productNote.value = product.note || product.notes || "";

  productIsNew.checked = product.isNew === true;

  productTrending.checked =
    product.trending === true ||
    product.isTrending === true ||
    product.featured === true;

  productActive.checked = product.active !== false;

  setProductDetailsFields(
    product.features || [],
    product.specifications || {}
  );

  formHeading.textContent = "Edit Product";
  saveProductBtn.textContent = "Update Product";

  showMessage(
    productMessage,
    "Editing: " + (product.name || "Product")
  );

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ========================================
// DELETE PRODUCT
// ========================================

async function deleteProduct(id, name) {
  const confirmed = window.confirm(
    `Are you sure you want to permanently delete "${name}"?`
  );

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "products", id));

    showMessage(adminMessage, "Product deleted successfully.");

    if (productId.value === id) {
      clearProductForm();
    }

    await loadAdminProducts();

  } catch (error) {
    console.error("Delete product error:", error);

    showMessage(adminMessage, error.message, true);
  }
}
