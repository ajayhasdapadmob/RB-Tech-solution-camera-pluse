
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
   GLOBAL VARIABLES
========================================= */

let currentTenantId = null;
let currentTenant = null;
let currentWebsiteMode = null;

let allProducts = [];
let filteredProducts = [];
let currentProduct = null;
let captchaAnswer = null;

/* =========================================
   WEBSITE SETTINGS
========================================= */

const LEGACY_WHATSAPP_NUMBER = "919663116089";
const INTELLO_WHATSAPP_NUMBER = "919448735433";
const INTELLO_EMAIL = "intelloelectric@gmail.com";
const INTELLO_LOGO =
  "https://raw.githubusercontent.com/ajayhasdapadmob/RB-Tech-solution-camera-pluse/main/images/products/intello-logo.png";

const DEFAULT_IMAGE =
  "https://ajayhasdapadmob.github.io/RB-Tech-solution-camera-pluse/images/products/jaise%20camera-01.jpg.png";

/* =========================================
   BRANDING HELPERS
========================================= */

function getBrandName() {
  if (currentWebsiteMode === "legacy") {
    return "RB Tech Solution";
  }

  return currentTenant?.businessName === "Intelloelectric"
    ? "Intello Electric"
    : (currentTenant?.businessName || "Intello Electric");
}

function getWhatsAppNumber() {
  if (currentWebsiteMode === "legacy") {
    return LEGACY_WHATSAPP_NUMBER;
  }

  const raw = String(
    currentTenant?.phone || INTELLO_WHATSAPP_NUMBER
  ).replace(/\D/g, "");

  return raw.startsWith("91") ? raw : `91${raw}`;
}

function getFallbackImage() {
  return currentWebsiteMode === "legacy"
    ? DEFAULT_IMAGE
    : INTELLO_LOGO;
}

function getTenantEmail() {
  return currentTenant?.email ||
    currentTenant?.businessEmail ||
    INTELLO_EMAIL;
}

function getTenantPhoneDisplay() {
  const number = getWhatsAppNumber();
  return `+${number.slice(0, 2)} ${number.slice(2)}`;
}

/* =========================================
   REPLACE STATIC WEBSITE TEXT
========================================= */

function replaceTenantText() {
  if (currentWebsiteMode !== "customer") return;

  const name = getBrandName();
  const phone = getTenantPhoneDisplay();
  const email = getTenantEmail();
  const owner = currentTenant?.ownerName || "FAYAZ";

  const replacements = [
    [/RB TECH SOLUTION/g, name.toUpperCase()],
    [/RB Tech Solution/g, name],
    [/RB Tech solution/g, name],
    [/Ajay Hasda/g, owner],
    [/ajayhasda623@gmail\.com/g, email],
    [/\+91 96631 16089/g, phone],
    [/919663116089/g, getWhatsAppNumber()],
    [/CCTV & SECURITY SYSTEMS/g, "COMPUTER AND CCTV SALES AND SERVICES"],
    [/CCTV & Security Systems/g, "Computer and CCTV Sales and Services"]
  ];

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT
  );

  const textNodes = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const parent = node.parentElement;

    if (!parent) continue;

    if (
      ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(parent.tagName)
    ) {
      continue;
    }

    textNodes.push(node);
  }

  textNodes.forEach(node => {
    let value = node.nodeValue;

    replacements.forEach(([pattern, replacement]) => {
      value = value.replace(pattern, () => replacement);
    });

    node.nodeValue = value;
  });
}

/* =========================================
   APPLY TENANT BRANDING
========================================= */

function applyTenantBranding() {
  const name = getBrandName();

  // Original RB Tech website
  if (currentWebsiteMode === "legacy") {
    document.title = "RB Tech Solution | CCTV & Security Systems";
    return;
  }

  const phone = getTenantPhoneDisplay();
  const digits = getWhatsAppNumber();
  const email = getTenantEmail();

  const logoPath =
  currentTenantId === "intelloelectric"
    ? INTELLO_LOGO
    : (
        currentTenant?.logoUrl ||
        currentTenant?.logo ||
        INTELLO_LOGO
      );

  document.title =
    `${name} | Computer and CCTV Sales and Services`;

  document.querySelector('meta[name="description"]')
    ?.setAttribute(
      "content",
      `${name} provides computer, laptop, CCTV, door phone and security system sales and services.`
    );

  document.querySelector('meta[name="author"]')
    ?.setAttribute("content", name);

  document.querySelector('meta[name="keywords"]')
    ?.setAttribute(
      "content",
      `${name}, Computer Sales, Laptop Sales, CCTV, Door Phone, Security Systems`
    );

  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", "#087f3c");

  document.querySelector('link[rel="canonical"]')
    ?.setAttribute(
      "href",
      `https://${location.hostname.replace(/^www\./, "")}/`
    );

  // Logo and favicon
  document.querySelectorAll(
    ".brand img, #siteLogo, #siteFavicon, link[rel='icon']"
  ).forEach(element => {
    if (element.tagName === "LINK") {
      element.href = logoPath;
    } else {
      element.src = logoPath;
      element.alt = `${name} Logo`;
      element.style.display = "block";
      element.style.objectFit = "contain";
    }
  });

  // Hero image
  document.querySelectorAll(
    ".hero-static-image, #heroFallbackImage"
  ).forEach(image => {
    image.src = logoPath;
    image.alt = name;
    image.style.objectFit = "contain";
    image.style.background = "#fff";
  });

  // Phone links
  document.querySelectorAll(
    'a[href^="tel:"], #topPhoneLink'
  ).forEach(link => {
    link.href = `tel:+${digits}`;
    link.textContent = phone;
  });

  // WhatsApp links
  document.querySelectorAll(
    'a[href*="wa.me"], .whatsapp-float, #floatingWhatsApp'
  ).forEach(link => {
    link.href = `https://wa.me/${digits}`;
    link.setAttribute(
      "aria-label",
      `Contact ${name} on WhatsApp`
    );
  });

  // Email links
  document.querySelectorAll('a[href^="mailto:"]')
    .forEach(link => {
      link.href = `mailto:${email}`;
      link.textContent = email;
    });

  // Footer and popup
  document.querySelectorAll(
    "#footerBrandName, #footerCopyrightBrand, #popupCompanyName, #siteBrandName"
  ).forEach(element => {
    element.textContent = name;
  });

  document.querySelectorAll(
    "#footerPhoneLink, #popupPhoneLink"
  ).forEach(link => {
    link.href = `https://wa.me/${digits}`;
    link.textContent = phone;
  });

  document.querySelectorAll(
    "#footerEmailLink, #popupEmailLink"
  ).forEach(link => {
    link.href = `mailto:${email}`;
    link.textContent = email;
  });

  const tagline = document.getElementById("siteBrandTagline");

  if (tagline) {
    tagline.textContent =
      "COMPUTER AND CCTV SALES AND SERVICES";
  }

  replaceTenantText();
}

/* =========================================
   GENERAL HELPERS
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

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return getFallbackImage();
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
    return value.split(/\n|,/).map(x => x.trim()).filter(Boolean);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, val]) => `${key}: ${val}`);
  }

  return [];
}

function getProductImage(product) {
  return safeURL(
    product.imageUrl ||
    product.image ||
    product.photo ||
    product.productImage ||
    getFallbackImage()
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
   PRODUCT DETAILS CSS
========================================= */

function addProductDetailsStyles() {
  if (document.getElementById("rbProductDetailsStyles")) return;

  const style = document.createElement("style");
  style.id = "rbProductDetailsStyles";

  style.textContent = `
    #productModal {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 99990;
      background: rgba(0,0,0,.78);
      padding: 18px;
      overflow-y: auto;
      align-items: flex-start;
      justify-content: center;
    }

    #productModal.active {
      display: flex !important;
    }

    #productModal #modalContent {
      position: relative;
      width: 100%;
      max-width: 1250px;
      margin: 15px auto;
      padding: 28px;
      background: #fff;
      color: #202b35;
      border-radius: 8px;
      box-sizing: border-box;
      font-family: Arial, sans-serif;
    }

    .rb-detail-header {
      border-bottom: 3px solid #13a6b5;
      padding-bottom: 15px;
      margin-bottom: 22px;
    }

    .rb-detail-brand {
      color: #087b91;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 1.5px;
    }

    .rb-detail-header h2 {
      margin: 8px 0;
      font-size: 25px;
      color: #172b3a;
    }

    .rb-detail-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.25fr) minmax(300px, .75fr);
      gap: 25px;
      align-items: start;
    }

    .rb-detail-main,
    .rb-rfi-column {
      min-width: 0;
    }

    .rb-detail-product {
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 22px;
      align-items: start;
      margin-bottom: 25px;
    }

    .rb-detail-photo {
      background: #f6f8fa;
      border: 1px solid #e2e8ee;
      padding: 15px;
      text-align: center;
    }

    .rb-detail-photo img {
      width: 100%;
      height: 210px;
      object-fit: contain;
    }

    .rb-detail-summary h3 {
      color: #172b3a;
      font-size: 21px;
      margin: 0 0 12px;
    }

    .rb-detail-summary p {
      line-height: 1.6;
      font-size: 14px;
      margin: 8px 0;
    }

    .rb-detail-section {
      margin-top: 24px;
    }

    .rb-detail-section h3 {
      color: #fff;
      background: #087f95;
      padding: 12px 15px;
      margin: 0;
      font-size: 16px;
    }

    .rb-detail-description {
      line-height: 1.7;
      padding: 14px;
      background: #f7f9fb;
      border: 1px solid #e3e9ee;
    }

    .rb-detail-features {
      padding: 15px 15px 15px 35px;
      line-height: 1.8;
      border: 1px solid #e3e9ee;
      margin: 0;
    }

    .rb-spec-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .rb-spec-table th,
    .rb-spec-table td {
      border: 1px solid #dce3e9;
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
      overflow-wrap: anywhere;
    }

    .rb-spec-table th {
      width: 36%;
      background: #f0f4f7;
      color: #263746;
      font-weight: 700;
    }

    .rb-spec-table tr:nth-child(even) td {
      background: #fafcfd;
    }

    .rb-rfi-column {
      border: 1px solid #dce3e9;
      background: #f8fafc;
      padding: 18px;
      border-top: 4px solid #087f95;
    }

    .rb-rfi-heading {
      color: #173447;
      font-size: 20px;
      font-weight: 800;
      margin: 0 0 6px;
    }

    .rb-rfi-subtitle {
      color: #647381;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 17px;
    }

    .rb-rfi-form label {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: #263746;
      margin: 12px 0 6px;
    }

    .rb-rfi-form input,
    .rb-rfi-form select,
    .rb-rfi-form textarea {
      display: block;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      padding: 11px 12px;
      border: 1px solid #cbd5df;
      border-radius: 3px;
      background: #fff;
      color: #263746;
      font-size: 14px;
      outline: none;
    }

    .rb-rfi-form input:focus,
    .rb-rfi-form select:focus,
    .rb-rfi-form textarea:focus {
      border-color: #087f95;
      box-shadow: 0 0 0 2px rgba(8,127,149,.1);
    }

    .rb-rfi-form textarea {
      min-height: 95px;
      resize: vertical;
    }

    .rb-phone-row {
      display: grid;
      grid-template-columns: 105px 1fr;
      gap: 7px;
    }

    .rb-rfi-privacy {
      display: flex;
      gap: 9px;
      align-items: flex-start;
      margin: 15px 0;
      font-size: 12px;
      line-height: 1.5;
      color: #4b5965;
    }

    .rb-rfi-privacy input {
      width: auto;
      margin-top: 3px;
    }

    .rb-rfi-captcha {
      background: #edf3f6;
      border: 1px solid #d7e0e6;
      padding: 12px;
      margin: 12px 0;
    }

    .rb-rfi-captcha strong {
      display: block;
      margin-bottom: 8px;
      color: #263746;
    }

    .rb-rfi-submit,
    .rb-rfi-whatsapp {
      display: block;
      width: 100%;
      padding: 13px;
      border: 0;
      border-radius: 3px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 800;
      margin-top: 10px;
    }

    .rb-rfi-submit {
      color: #fff;
      background: #087f95;
    }

    .rb-rfi-submit:hover {
      background: #066477;
    }

    .rb-rfi-submit:disabled {
      opacity: .6;
      cursor: wait;
    }

    .rb-rfi-whatsapp {
      background: #159447;
      color: #fff;
    }

    .rb-detail-brochure {
      display: inline-block;
      margin-top: 15px;
      color: #087f95;
      font-weight: 700;
    }

    #modalClose {
      position: absolute;
      top: 10px;
      right: 13px;
      z-index: 5;
      border: 0;
      background: #172b3a;
      color: #fff;
      border-radius: 50%;
      width: 35px;
      height: 35px;
      font-size: 25px;
      line-height: 30px;
      cursor: pointer;
    }

    .rb-detail-actions {
      display: flex;
      gap: 10px;
      margin-top: 15px;
      flex-wrap: wrap;
    }

    .rb-detail-actions button {
      padding: 11px 16px;
      border: 0;
      background: #087f95;
      color: #fff;
      cursor: pointer;
      border-radius: 3px;
      font-weight: 700;
    }

    @media(max-width: 850px) {
      #productModal #modalContent {
        padding: 20px 14px;
      }

      .rb-detail-layout {
        grid-template-columns: 1fr;
      }

      .rb-rfi-column {
        order: 2;
      }
    }

    @media(max-width: 520px) {
      #productModal {
        padding: 5px;
      }

      #productModal #modalContent {
        margin: 5px auto;
        padding: 17px 11px;
      }

      .rb-detail-product {
        grid-template-columns: 1fr;
      }

      .rb-detail-photo img {
        height: 190px;
      }

      .rb-detail-header h2 {
        font-size: 20px;
        padding-right: 25px;
      }

      .rb-spec-table {
        font-size: 12px;
      }

      .rb-spec-table th,
      .rb-spec-table td {
        padding: 8px 6px;
      }
    }
  `;

  document.head.appendChild(style);
}

/* =========================================
   RESOLVE WEBSITE TENANT
========================================= */

async function resolveWebsiteTenant() {
  const hostname = location.hostname
    .toLowerCase()
    .replace(/^www\./, "");

  const pathname = location.pathname.toLowerCase();

  // SPCK preview
  if (
    new URLSearchParams(location.search).get("tenant") ===
    "intelloelectric"
  ) {
    const snap = await getDoc(
      doc(db, "customers", "intelloelectric")
    );

    if (!snap.exists() || snap.data().status !== "active") {
      return false;
    }

    currentTenantId = "intelloelectric";
    currentTenant = {
      id: currentTenantId,
      ...snap.data()
    };

    currentWebsiteMode = "customer";
    return true;
  }

  // RB Tech official website
const isLegacyWebsite =
    hostname === "rb-tech-solution-camera-pluse.pages.dev" ||
    hostname === "rb-tech-solution-camera-pluse-pages.pages.dev" ||
    (
      hostname === "ajayhasdapadmob.github.io" &&
      pathname.startsWith("/rb-tech-solution-camera-pluse/")
    ) ||
    hostname === "localhost" ||
    hostname === "127.0.0.1";

  if (isLegacyWebsite) {
    const snap = await getDoc(
      doc(db, "customers", "customer1")
    );

    currentTenantId = "customer1";
    currentTenant = snap.exists()
      ? { id: currentTenantId, ...snap.data() }
      : null;

    currentWebsiteMode = "legacy";
    return true;
  }

  // INTELLO ELECTRIC OFFICIAL DOMAIN
  if (hostname === "intelloelectric.com") {
    const snap = await getDoc(
      doc(db, "customers", "intelloelectric")
    );

    if (!snap.exists() || snap.data().status !== "active") {
      console.error("Intello Electric customer is not active.");
      return false;
    }

    currentTenantId = "intelloelectric";
    currentTenant = {
      id: currentTenantId,
      ...snap.data()
    };

    currentWebsiteMode = "customer";

    console.log("Intello Electric website loaded.");
    return true;
  }

  // Custom domain mapping
  const websiteSnap = await getDoc(
    doc(db, "publicWebsites", hostname)
  );

  if (
    websiteSnap.exists() &&
    websiteSnap.data().active === true
  ) {
    const website = websiteSnap.data();

    if (
      website.domain &&
      website.domain.toLowerCase().replace(/^www\./, "") !== hostname
    ) {
      return false;
    }

    const customerId = website.customerId;
    if (!customerId) return false;

    const customerSnap = await getDoc(
      doc(db, "customers", customerId)
    );

    if (
      !customerSnap.exists() ||
      customerSnap.data().status !== "active"
    ) {
      return false;
    }

    currentTenantId = customerId;
    currentTenant = {
      id: customerId,
      ...customerSnap.data()
    };

    currentWebsiteMode = "customer";

    console.log("Customer website:", currentTenantId);
    return true;
  }

  // Fallback: search domain in customer records
  const customersSnap = await getDocs(
    collection(db, "customers")
  );

  const matched = customersSnap.docs.find(item => {
    const data = item.data();

    const domains = [
      data.domain,
      data.customDomain,
      data.websiteDomain,
      ...(Array.isArray(data.domains) ? data.domains : [])
    ]
      .filter(Boolean)
      .map(value =>
        String(value).toLowerCase().replace(/^www\./, "")
      );

    return domains.includes(hostname);
  });

  if (!matched || matched.data().status !== "active") {
    console.error("No active tenant found:", hostname);
    return false;
  }

  currentTenantId = matched.id;
  currentTenant = {
    id: matched.id,
    ...matched.data()
  };

  currentWebsiteMode = "customer";
  return true;
}

/* =========================================
   LOAD TENANT-SPECIFIC PRODUCTS
========================================= */

async function loadProducts() {
  const grid = document.getElementById("productGrid");
  const trendingGrid = document.getElementById("trendingGrid");

  if (grid) {
    grid.innerHTML = "<p>Loading products...</p>";
  }

  try {
    const productMap = new Map();

    if (
      !currentTenantId ||
      !["legacy", "customer"].includes(currentWebsiteMode)
    ) {
      throw new Error("Website tenant is not verified.");
    }

    // Old RB Tech products: legacy website only
    if (currentWebsiteMode === "legacy") {
      try {
        const oldQuery = query(
          collection(db, "products"),
          where("active", "==", true)
        );

        const oldSnap = await getDocs(oldQuery);

        oldSnap.forEach(item => {
          productMap.set("products:" + item.id, {
            id: item.id,
            ...item.data(),
            sourceCollection: "products"
          });
        });
      } catch (error) {
        console.warn("Legacy products not loaded:", error);
      }
    }

    // Customer products: only matching customerId
    const customerQuery = query(
      collection(db, "customerProducts"),
      where("customerId", "==", currentTenantId),
      where("active", "==", true)
    );

    const customerSnap = await getDocs(customerQuery);

    customerSnap.forEach(item => {
      productMap.set("customerProducts:" + item.id, {
        id: item.id,
        ...item.data(),
        sourceCollection: "customerProducts"
      });
    });

    allProducts = Array.from(productMap.values());
    filteredProducts = [...allProducts];

    console.log("Website mode:", currentWebsiteMode);
    console.log("Current tenant:", currentTenantId);
    console.log("Products loaded:", allProducts.length);

    renderProducts();
    renderTrendingProducts();

  } catch (error) {
    console.error("Product loading error:", error);

    allProducts = [];
    filteredProducts = [];

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
        <img src="${image}" alt="${name}" loading="lazy"
          onerror="this.onerror=null;this.src='${getFallbackImage()}'">
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

function renderProducts() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  if (!filteredProducts.length) {
    grid.innerHTML = "<p>No products found.</p>";
    return;
  }

  grid.innerHTML = filteredProducts.map(productCardHTML).join("");
}

function renderTrendingProducts() {
  const grid = document.getElementById("trendingGrid");
  if (!grid) return;

  const trending = allProducts.filter(isTrending);

  if (!trending.length) {
    grid.innerHTML = "<p>No trending products available.</p>";
    return;
  }

  grid.innerHTML = trending.map(productCardHTML).join("");
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

    return (
      (!search || searchable.includes(search)) &&
      (!category || getProductCategory(product) === category)
    );
  });

  renderProducts();
}

/* =========================================
   TECHNICAL SPECIFICATIONS
========================================= */

function specificationsHTML(specifications) {
  if (!specifications) return "";

  let rows = [];

  if (Array.isArray(specifications)) {
    rows = specifications.map(item => ({
      key: item.label || item.name || item.key || "",
      value: item.value ?? item.description ?? ""
    }));
  } else if (typeof specifications === "object") {
    rows = Object.entries(specifications).map(([key, value]) => ({
      key,
      value
    }));
  }

  rows = rows.filter(row => row.key && row.value !== "");

  if (!rows.length) return "";

  return `
    <div class="rb-detail-section">
      <h3>Technical Specifications</h3>

      <table class="rb-spec-table">
        <tbody>
          ${rows.map(row => `
            <tr>
              <th>${escapeHTML(row.key)}</th>
              <td>${escapeHTML(
                typeof row.value === "object"
                  ? JSON.stringify(row.value)
                  : row.value
              )}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* =========================================
   COUNTRY OPTIONS
========================================= */

function countryOptionsHTML() {
  const countries = [
    ["+91", "India (+91)"],
    ["+1", "USA / Canada (+1)"],
    ["+44", "United Kingdom (+44)"],
    ["+971", "UAE (+971)"],
    ["+966", "Saudi Arabia (+966)"],
    ["+65", "Singapore (+65)"],
    ["+61", "Australia (+61)"],
    ["+880", "Bangladesh (+880)"],
    ["+977", "Nepal (+977)"],
    ["+94", "Sri Lanka (+94)"]
  ];

  return countries.map(([code, label]) => `
    <option value="${code}" ${code === "+91" ? "selected" : ""}>
      ${label}
    </option>
  `).join("");
}

/* =========================================
   PRODUCT RFI FORM
========================================= */

function productRFIFormHTML(product) {
  const name = escapeHTML(getProductName(product));
  const model = escapeHTML(product.model || "");

  const a = Math.floor(Math.random() * 8) + 2;
  const b = Math.floor(Math.random() * 8) + 1;

  captchaAnswer = a + b;

  return `
    <div class="rb-rfi-column">

      <h3 class="rb-rfi-heading">Request for Information</h3>

      <p class="rb-rfi-subtitle">
        Please complete the form below. Our team will contact you
        regarding this product.
      </p>

      <form id="productRFIForm" class="rb-rfi-form">

        <label>Product</label>
        <input type="text" value="${name}" readonly>

        ${model ? `
          <label>Model Number</label>
          <input type="text" value="${model}" readonly>
        ` : ""}

        <label for="rfiName">Name *</label>
        <input id="rfiName" type="text" name="name"
          placeholder="Enter your full name" required maxlength="100">

        <label for="rfiEmail">Email Address *</label>
        <input id="rfiEmail" type="email" name="email"
          placeholder="Enter your email address" required maxlength="150">

        <label>Phone Number *</label>

        <div class="rb-phone-row">
          <select name="countryCode" aria-label="Country code" required>
            ${countryOptionsHTML()}
          </select>

          <input type="tel" name="phone"
            placeholder="Phone number" required
            inputmode="numeric" pattern="[0-9]{6,15}"
            maxlength="15">
        </div>

        <label for="rfiCompany">Company Name</label>
        <input id="rfiCompany" type="text" name="company"
          placeholder="Enter company name" maxlength="150">

        <label for="rfiMessage">Message *</label>
        <textarea id="rfiMessage" name="message"
          placeholder="Tell us about your requirements"
          required maxlength="2000"></textarea>

        <div class="rb-rfi-captcha">
          <strong>Security Verification</strong>

          <label for="rfiCaptcha">
            What is ${a} + ${b}?
          </label>

          <input id="rfiCaptcha" type="number"
            name="captcha" placeholder="Enter answer" required>
        </div>

        <label class="rb-rfi-privacy">
          <input type="checkbox" name="privacy" required>
          <span>
            I agree to the Privacy Policy and consent to being
            contacted by ${escapeHTML(getBrandName())} regarding this enquiry.
          </span>
        </label>

        <button type="submit" class="rb-rfi-submit">
          SUBMIT REQUEST
        </button>

      </form>

      <button type="button" class="rb-rfi-whatsapp"
        id="productWhatsApp">
        WhatsApp Enquiry
      </button>

    </div>
  `;
}

/* =========================================
   PRODUCT DETAILS MODAL
========================================= */

function openProductDetails(productId) {
  const product = allProducts.find(item => item.id === productId);

  if (!product) {
    showMessage("Product not found.", "error");
    return;
  }

  currentProduct = product;

  addProductDetailsStyles();

  const modal = document.getElementById("productModal");
  const content = document.getElementById("modalContent");

  if (!modal || !content) {
    showMessage("Product details modal not found in HTML.", "error");
    return;
  }

  const features = normalizeArray(product.features);
  const brochure = product.brochureUrl || product.pdfUrl || "";

  content.innerHTML = `
    <button id="modalClose" type="button"
      aria-label="Close product details">×</button>

    <div class="rb-detail-header">
      <div class="rb-detail-brand">
        ${escapeHTML(getBrandName().toUpperCase())}
        | COMPUTER & CCTV SALES AND SERVICES
      </div>
      <h2>${escapeHTML(getProductName(product))}</h2>
    </div>

    <div class="rb-detail-layout">

      <div class="rb-detail-main">

        <div class="rb-detail-product">

          <div class="rb-detail-photo">
            <img src="${escapeHTML(getProductImage(product))}"
              alt="${escapeHTML(getProductName(product))}"
              onerror="this.onerror=null;this.src='${getFallbackImage()}'">
          </div>

          <div class="rb-detail-summary">

            <h3>${escapeHTML(getProductName(product))}</h3>

            <p><strong>Category:</strong>
              ${escapeHTML(getProductCategory(product))}
            </p>

            ${product.model ? `
              <p><strong>Model:</strong>
                ${escapeHTML(product.model)}
              </p>
            ` : ""}

            ${product.description ? `
              <p>${escapeHTML(product.description)}</p>
            ` : ""}

            <div class="rb-detail-actions">
              <button type="button" id="productWhatsAppTop">
                WhatsApp Enquiry
              </button>
            </div>

            ${brochure ? `
              <a class="rb-detail-brochure"
                href="${escapeHTML(safeURL(brochure))}"
                target="_blank" rel="noopener">
                View / Download Product Brochure
              </a>
            ` : ""}

          </div>
        </div>

        ${product.description ? `
          <div class="rb-detail-section">
            <h3>Product Description</h3>
            <div class="rb-detail-description">
              ${escapeHTML(product.description)}
            </div>
          </div>
        ` : ""}

        ${features.length ? `
          <div class="rb-detail-section">
            <h3>Key Features</h3>
            <ul class="rb-detail-features">
              ${features.map(feature =>
                `<li>${escapeHTML(feature)}</li>`
              ).join("")}
            </ul>
          </div>
        ` : ""}

        ${specificationsHTML(product.specifications)}

      </div>

      ${productRFIFormHTML(product)}

    </div>
  `;

  modal.style.display = "flex";
  modal.classList.add("active");
  document.body.style.overflow = "hidden";

  document.getElementById("modalClose")
    ?.addEventListener("click", closeProductModal);

  document.getElementById("productWhatsApp")
    ?.addEventListener("click", () => whatsappProduct(productId));

  document.getElementById("productWhatsAppTop")
    ?.addEventListener("click", () => whatsappProduct(productId));

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

/* =========================================
   WHATSAPP PRODUCT ENQUIRY
========================================= */

function whatsappProduct(productId) {
  const product = allProducts.find(item => item.id === productId);
  if (!product) return;

  const message = [
    `Hello ${getBrandName()},`,
    "",
    "I am interested in this product:",
    `Product: ${getProductName(product)}`,
    `Category: ${getProductCategory(product)}`,
    `Model: ${product.model || "Not specified"}`,
    "",
    "Please share more details."
  ].join("\n");

  window.open(
    `https://wa.me/${getWhatsAppNumber()}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener"
  );
}

/* =========================================
   SAVE ENQUIRY
========================================= */

async function saveEnquiry(data) {
  if (!currentTenantId) {
    throw new Error("Customer website is not identified.");
  }

  await addDoc(collection(db, "enquiries"), {
    ...data,
    customerId: currentTenantId,
    customerUid: currentTenant?.uid || "",
    status: "New",
    createdAt: serverTimestamp()
  });
}

/* =========================================
   PRODUCT RFI SUBMISSION
========================================= */

async function submitProductRFI(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);

  const enteredCaptcha = Number(formData.get("captcha"));

  if (enteredCaptcha !== captchaAnswer) {
    showMessage("Incorrect security verification answer.", "error");
    return;
  }

  if (!formData.get("privacy")) {
    showMessage("Please accept the Privacy Policy.", "error");
    return;
  }

  const phone = String(formData.get("phone") || "").replace(/\D/g, "");

  if (phone.length < 6 || phone.length > 15) {
    showMessage("Please enter a valid phone number.", "error");
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";
  }

  try {
    await saveEnquiry({
      type: "Product RFI",
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      countryCode: formData.get("countryCode") || "+91",
      phone: `${formData.get("countryCode") || "+91"} ${phone}`,
      company: String(formData.get("company") || "").trim(),
      message: String(formData.get("message") || "").trim(),
      productName: currentProduct ? getProductName(currentProduct) : "",
      productModel: currentProduct?.model || "",
      customerProductId: currentProduct?.id || "",
      privacyAccepted: true
    });

    showMessage(
      "Your enquiry has been submitted successfully.",
      "success"
    );

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
      submitButton.textContent = "SUBMIT REQUEST";
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
   MODAL EVENTS
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
    const tenantReady = await resolveWebsiteTenant();

    if (!tenantReady) {
      throw new Error(
        "This domain is not mapped to an active customer website. For SPCK preview, add ?tenant=intelloelectric to the URL."
      );
    }

    applyTenantBranding();

    requestAnimationFrame(() => {
      applyTenantBranding();
    });

    const search = document.getElementById("searchInput");
    const category = document.getElementById("categoryFilter");

    search?.addEventListener("input", filterProducts);
    category?.addEventListener("change", filterProducts);

    setupCategoryButtons();
    setupModalEvents();
    setupWebsiteInquiryForm();
    addProductDetailsStyles();

    await loadProducts();

    console.log(
      "Customer website initialized:",
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
