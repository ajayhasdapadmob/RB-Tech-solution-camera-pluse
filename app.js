
import { db } from "./firebase.js";

import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* =========================================
   RB TECH SOLUTION - PUBLIC WEBSITE APP
========================================= */

const WHATSAPP_NUMBER = "919663116089";

const DEFAULT_IMAGE =
  "https://ajayhasdapadmob.github.io/RB-Tech-solution-camera-pluse/images/products/jaise%20camera-01.jpg.png";

const CATEGORIES = [
  "CCTV Cameras",
  "Wireless Cameras",
  "DVR & NVR",
  "IP Cameras",
  "PTZ Cameras",
  "Video Door Phone",
  "Biometric Systems",
  "Networking",
  "Storage",
  "Accessories"
];

let currentTenant = null;
let currentTenantId = "";
let currentWebsiteMode = "legacy";

let allProducts = [];
let filteredProducts = [];
let currentProduct = null;

/* =========================================
   BASIC HELPERS
========================================= */

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function safeURL(value = "") {
  const url = String(value || "").trim();

  if (
    url.startsWith("https://") ||
    url.startsWith("http://")
  ) {
    return url;
  }

  return DEFAULT_IMAGE;
}

function showMessage(message, type = "info") {
  let box = document.getElementById("appMessage");

  if (!box) {
    box = document.createElement("div");
    box.id = "appMessage";

    Object.assign(box.style, {
      position: "fixed",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "999999",
      padding: "13px 22px",
      borderRadius: "7px",
      color: "#fff",
      fontSize: "14px",
      maxWidth: "90%",
      textAlign: "center",
      boxShadow: "0 4px 15px rgba(0,0,0,.25)"
    });

    document.body.appendChild(box);
  }

  box.style.background =
    type === "error" ? "#dc2626" :
    type === "success" ? "#087f3c" : "#26352b";

  box.textContent = message;
  box.style.display = "block";

  clearTimeout(box.hideTimer);

  box.hideTimer = setTimeout(() => {
    box.style.display = "none";
  }, 4000);
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    return value
      .split(/\n|,/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, val]) => `${key}: ${val}`);
  }

  return [];
}

function getProductImage(product) {
  return safeURL(
    product.imageUrl ||
    product.image ||
    product.photo ||
    product.productImage ||
    DEFAULT_IMAGE
  );
}

function getProductName(product) {
  return product.name || product.productName || "Security Product";
}

function getProductCategory(product) {
  return product.category || "Accessories";
}

function isTrending(product) {
  return (
    product.trending === true ||
    product.isTrending === true ||
    product.featured === true
  );
}

/* =========================================
   TENANT / CUSTOMER WEBSITE
========================================= */

async function resolveWebsiteTenant() {
  const hostname = location.hostname.toLowerCase();

  const legacyHosts = [
    "rb-tech-solution-camera-pluse.pages.dev",
    "ajayhasdapadmob.github.io",
    "localhost",
    "127.0.0.1"
  ];

  if (legacyHosts.includes(hostname)) {
    currentWebsiteMode = "legacy";
    currentTenantId = "customer1";

    const tenantSnap = await getDoc(
      doc(db, "customers", "customer1")
    );

    if (tenantSnap.exists()) {
      currentTenant = {
        id: tenantSnap.id,
        ...tenantSnap.data()
      };
    } else {
      currentTenant = {
        id: "customer1",
        businessName: "RB Tech Solution"
      };
    }

    window.RB_TENANT = currentTenant;

    return currentTenant;
  }

  /*
    Custom domain routing:
    Customer ID is resolved using customers documents.
    No publicWebsites collection is required here.
  */

  const customersSnap = await getDocs(
    collection(db, "customers")
  );

  const matchedCustomer = customersSnap.docs.find(item => {
    const data = item.data();

    const domains = [
      data.domain,
      data.customDomain,
      data.websiteDomain,
      ...(Array.isArray(data.domains) ? data.domains : [])
    ]
      .filter(Boolean)
      .map(domain => String(domain).toLowerCase());

    return domains.includes(hostname);
  });

  if (!matchedCustomer) {
    throw new Error(
      "This website domain is not connected to a customer."
    );
  }

  currentTenantId = matchedCustomer.id;
  currentTenant = {
    id: matchedCustomer.id,
    ...matchedCustomer.data()
  };

  currentWebsiteMode = "customer";

  window.RB_TENANT = currentTenant;

  return currentTenant;
}

/* =========================================
   LOAD PRODUCTS
========================================= */

async function loadProducts() {
  const grid = document.getElementById("productGrid");
  const trendingGrid = document.getElementById("trendingGrid");

  if (grid) {
    grid.innerHTML = "<p>Loading products...</p>";
  }

  try {
    const productMap = new Map();

    /*
      Old product collection.
      Only load for the legacy main website.
    */

    if (currentWebsiteMode === "legacy") {
      try {
        const oldQuery = query(
          collection(db, "products"),
          where("active", "==", true)
        );

        const oldSnap = await getDocs(oldQuery);

        oldSnap.forEach(item => {
          productMap.set(item.id, {
            id: item.id,
            ...item.data(),
            sourceCollection: "products"
          });
        });
      } catch (error) {
        console.warn("Legacy products not loaded:", error);
      }
    }

    /*
      Customer products.
      Only matching customer products are loaded.
    */

    const customerQuery = query(
      collection(db, "customerProducts"),
      where("customerId", "==", currentTenantId),
      where("active", "==", true)
    );

    const customerSnap = await getDocs(customerQuery);

    customerSnap.forEach(item => {
      productMap.set(item.id, {
        id: item.id,
        ...item.data(),
        sourceCollection: "customerProducts"
      });
    });

    allProducts = Array.from(productMap.values());

    filteredProducts = [...allProducts];

    renderProducts();
    renderTrendingProducts();

  } catch (error) {
    console.error("Product loading error:", error);

    if (grid) {
      grid.innerHTML =
        "<p>Unable to load products. Please try again later.</p>";
    }

    if (trendingGrid) {
      trendingGrid.innerHTML =
        "<p>Trending products are currently unavailable.</p>";
    }
  }
}

/* =========================================
   PRODUCT CARD
========================================= */

function productCardHTML(product) {
  const name = escapeHTML(getProductName(product));
  const category = escapeHTML(getProductCategory(product));
  const model = escapeHTML(product.model || "");
  const image = escapeHTML(getProductImage(product));
  const id = escapeHTML(product.id);

  return `
    <div class="product-card">
      <div class="product-image"
           onclick="window.openProductDetails('${id}')">

        <img src="${image}"
             alt="${name}"
             loading="lazy"
             onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}'">

      </div>

      <div class="product-info">
        <span class="product-category">${category}</span>

        <h3>${name}</h3>

        ${model ? `<p>Model: ${model}</p>` : ""}

        <button type="button"
          onclick="window.openProductDetails('${id}')">
          VIEW DETAILS
        </button>

        <button type="button"
          onclick="window.whatsappProduct('${id}')">
          ENQUIRE NOW
        </button>
      </div>
    </div>
  `;
}

/* =========================================
   RENDER PRODUCTS
========================================= */

function renderProducts() {
  const grid = document.getElementById("productGrid");

  if (!grid) return;

  if (!filteredProducts.length) {
    grid.innerHTML = "<p>No products found.</p>";
    return;
  }

  grid.innerHTML = filteredProducts
    .map(productCardHTML)
    .join("");
}

/* =========================================
   TRENDING PRODUCTS
========================================= */

function renderTrendingProducts() {
  const grid = document.getElementById("trendingGrid");

  if (!grid) return;

  const trending = allProducts.filter(isTrending);

  if (!trending.length) {
    grid.innerHTML = "<p>No trending products available.</p>";
    return;
  }

  grid.innerHTML = trending
    .map(productCardHTML)
    .join("");
}

/* =========================================
   SEARCH AND CATEGORY FILTER
========================================= */

function filterProducts() {
  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");

  const search = searchInput
    ? searchInput.value.trim().toLowerCase()
    : "";

  const category = categoryFilter
    ? categoryFilter.value
    : "";

  filteredProducts = allProducts.filter(product => {
    const searchable = [
      product.name,
      product.productName,
      product.model,
      product.category,
      product.description
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const searchMatch =
      !search || searchable.includes(search);

    const categoryMatch =
      !category || getProductCategory(product) === category;

    return searchMatch && categoryMatch;
  });

  renderProducts();
}

/* =========================================
   PRODUCT DETAILS MODAL
========================================= */

function openProductDetails(productId) {
  const product = allProducts.find(
    item => item.id === productId
  );

  if (!product) {
    showMessage("Product not found.", "error");
    return;
  }

  currentProduct = product;

  const modal = document.getElementById("productModal");
  const content = document.getElementById("modalContent");

  if (!modal || !content) return;

  const features = normalizeArray(product.features);
  const specifications = product.specifications || {};

  let specificationHTML = "";

  if (Array.isArray(specifications)) {
    specificationHTML = specifications.map(item => `
      <tr>
        <th>${escapeHTML(item.label || item.name || "")}</th>
        <td>${escapeHTML(item.value || "")}</td>
      </tr>
    `).join("");
  } else if (specifications && typeof specifications === "object") {
    specificationHTML = Object.entries(specifications)
      .map(([key, value]) => `
        <tr>
          <th>${escapeHTML(key)}</th>
          <td>${escapeHTML(value)}</td>
        </tr>
      `)
      .join("");
  }

  const brochure = product.brochureUrl || product.pdfUrl || "";

  content.innerHTML = `
    <button id="modalClose" type="button"
      aria-label="Close product details">×</button>

    <div class="product-detail-layout">

      <div class="product-detail-image">
        <img src="${escapeHTML(getProductImage(product))}"
          alt="${escapeHTML(getProductName(product))}"
          onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}'">
      </div>

      <div class="product-detail-info">

        <h2>${escapeHTML(getProductName(product))}</h2>

        <p><strong>Category:</strong>
          ${escapeHTML(getProductCategory(product))}
        </p>

        ${product.model ? `
          <p><strong>Model:</strong>
          ${escapeHTML(product.model)}</p>
        ` : ""}

        ${product.description ? `
          <div class="product-description">
            <h3>Product Description</h3>
            <p>${escapeHTML(product.description)}</p>
          </div>
        ` : ""}

        ${features.length ? `
          <div class="product-features">
            <h3>Key Features</h3>
            <ul>
              ${features.map(feature =>
                `<li>${escapeHTML(feature)}</li>`
              ).join("")}
            </ul>
          </div>
        ` : ""}

        ${specificationHTML ? `
          <div class="product-specifications">
            <h3>Technical Specifications</h3>

            <div style="overflow-x:auto">
              <table>
                <tbody>
                  ${specificationHTML}
                </tbody>
              </table>
            </div>
          </div>
        ` : ""}

        ${brochure ? `
          <p>
            <a href="${escapeHTML(safeURL(brochure))}"
              target="_blank" rel="noopener">
              View / Download Brochure
            </a>
          </p>
        ` : ""}

        <div class="product-detail-actions">
          <button type="button" id="productWhatsApp">
            WhatsApp Enquiry
          </button>

          <button type="button" id="productRFI">
            Request for Information
          </button>
        </div>

        <div id="productRFISection" style="display:none;">
          ${productRFIFormHTML(product)}
        </div>

      </div>
    </div>
  `;

  modal.style.display = "flex";
  modal.classList.add("active");

  document.body.style.overflow = "hidden";

  document.getElementById("modalClose")
    ?.addEventListener("click", closeProductModal);

  document.getElementById("productWhatsApp")
    ?.addEventListener("click", () => whatsappProduct(productId));

  document.getElementById("productRFI")
    ?.addEventListener("click", () => {
      const section = document.getElementById("productRFISection");

      if (section) {
        section.style.display = "block";
        section.scrollIntoView({ behavior: "smooth" });
      }
    });

  document.getElementById("productRFIForm")
    ?.addEventListener("submit", submitProductRFI);
}

function closeProductModal() {
  const modal = document.getElementById("productModal");

  if (modal) {
    modal.classList.remove("active");
    modal.style.display = "none";
  }

  document.body.style.overflow = "";
}

function productRFIFormHTML(product) {
  return `
    <form id="productRFIForm">

      <h3>Request for Information</h3>

      <input type="text" name="name"
        placeholder="Your Name" required>

      <input type="email" name="email"
        placeholder="Email Address" required>

      <input type="tel" name="phone"
        placeholder="Phone Number" required>

      <textarea name="message"
        placeholder="Your requirements"></textarea>

      <button type="submit">Submit Request</button>

    </form>
  `;
}

/* =========================================
   WHATSAPP ENQUIRY
========================================= */

function whatsappProduct(productId) {
  const product = allProducts.find(
    item => item.id === productId
  );

  if (!product) return;

  const message = [
    "Hello RB Tech Solution,",
    "",
    "I am interested in this product:",
    `Product: ${getProductName(product)}`,
    `Category: ${getProductCategory(product)}`,
    `Model: ${product.model || "Not specified"}`,
    "",
    "Please share more details."
  ].join("\n");

  window.open(
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener"
  );
}

/* =========================================
   ENQUIRY SAVE
========================================= */

async function saveEnquiry(data) {
  if (!currentTenantId) {
    throw new Error("Customer website is not identified.");
  }

  const enquiry = {
    ...data,
    customerId: currentTenantId,
    customerUid: currentTenant?.uid || "",
    status: "New",
    createdAt: serverTimestamp()
  };

  await addDoc(
    collection(db, "enquiries"),
    enquiry
  );
}

/* =========================================
   PRODUCT RFI SUBMISSION
========================================= */

async function submitProductRFI(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);

  const submitButton = form.querySelector(
    'button[type="submit"]'
  );

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";
  }

  try {
    await saveEnquiry({
      type: "Product RFI",
      name: formData.get("name") || "",
      email: formData.get("email") || "",
      phone: formData.get("phone") || "",
      message: formData.get("message") || "",
      productName: currentProduct
        ? getProductName(currentProduct)
        : "",
      customerProductId: currentProduct?.id || ""
    });

    showMessage("Your enquiry has been submitted.", "success");
    form.reset();

    closeProductModal();

  } catch (error) {
    console.error("RFI submission error:", error);
    showMessage(
      "Unable to submit enquiry. Please try WhatsApp.",
      "error"
    );

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Submit Request";
    }
  }
}

/* =========================================
   GENERAL WEBSITE INQUIRY FORM
========================================= */

function setupWebsiteInquiryForm() {
  const form = document.getElementById("websiteInquiryForm");

  if (!form) return;

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const formData = new FormData(form);

    try {
      await saveEnquiry({
        type: "Website Inquiry",
        name: formData.get("name") || "",
        email: formData.get("email") || "",
        phone: formData.get("phone") || "",
        message: formData.get("message") || ""
      });

      showMessage("Your enquiry has been submitted.", "success");
      form.reset();

    } catch (error) {
      console.error(error);
      showMessage("Unable to submit enquiry.", "error");
    }
  });
}

/* =========================================
   CATEGORY BUTTONS
========================================= */

function setupCategoryButtons() {
  document.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();

      const category = button.dataset.category;

      const filter = document.getElementById("categoryFilter");

      if (filter) {
        filter.value = category;
      }

      filterProducts();

      document.getElementById("products")
        ?.scrollIntoView({ behavior: "smooth" });
    });
  });
}

/* =========================================
   MODAL BACKDROP
========================================= */

function setupModalEvents() {
  const modal = document.getElementById("productModal");

  modal?.addEventListener("click", event => {
    if (event.target === modal) {
      closeProductModal();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeProductModal();
    }
  });
}

/* =========================================
   GLOBAL FUNCTIONS
========================================= */

window.openProductDetails = openProductDetails;
window.whatsappProduct = whatsappProduct;
window.closeProductModal = closeProductModal;

/* =========================================
   INITIALIZE WEBSITE
========================================= */

async function initializeWebsite() {
  try {
    await resolveWebsiteTenant();

    const search = document.getElementById("searchInput");
    const category = document.getElementById("categoryFilter");

    search?.addEventListener("input", filterProducts);
    category?.addEventListener("change", filterProducts);

    setupCategoryButtons();
    setupModalEvents();
    setupWebsiteInquiryForm();

    await loadProducts();

    console.log(
      "RB Tech Solution website initialized:",
      currentTenantId
    );

  } catch (error) {
    console.error("Website initialization error:", error);

    const grid = document.getElementById("productGrid");

    if (grid) {
      grid.innerHTML =
        "<p>Website configuration error. Please contact support.</p>";
    }
  }
}

initializeWebsite();
