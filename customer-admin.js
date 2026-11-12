import { renderMarketingAdmin } from "./marketing-admin.js";
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
   Dynamic PDF Specifications + OCR
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
let ocrLibrariesPromise = null;

/* =====================================
   CLOUDINARY SETTINGS
===================================== */

const CLOUDINARY_CLOUD_NAME = "ch5mab4a";
const CLOUDINARY_UPLOAD_PRESET = "rbtech_products";
const CLOUDINARY_PRODUCT_FOLDER = "rb-tech-solution/products";

const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PRODUCT_PDF_BYTES = 15 * 1024 * 1024;
const MAX_OCR_FILE_BYTES = 15 * 1024 * 1024;

const ALLOWED_PRODUCT_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

const ALLOWED_OCR_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

if ($("year")) {
  $("year").textContent = new Date().getFullYear();
}

/* =====================================
   COMMON HELPERS
===================================== */

function showMessage(element, message, success = false) {
  if (!element) return;

  element.textContent = message || "";
  element.className = success ? "message success" : "message";
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
  if (String(customer.status || "").toLowerCase() !== "active") {
    return { active: false, message: "Inactive" };
  }

  const expiry = customer.subscriptionExpiry;

  if (!expiry) {
    return { active: false, message: "Expiry date missing" };
  }

  const expiryDate = typeof expiry.toDate === "function"
    ? expiry.toDate()
    : new Date(expiry);

  if (Number.isNaN(expiryDate.getTime())) {
    return { active: false, message: "Invalid expiry date" };
  }

  if (expiryDate.getTime() <= Date.now()) {
    return { active: false, message: "Expired" };
  }

  return { active: true, message: "Active" };
}

/* =====================================
   LOAD CUSTOMER
===================================== */

async function loadCustomer(user) {
  showMessage(loginMessage, "Customer account verify ho raha hai...");

  try {
    const customer = await getCustomerByUid(user.uid);

    if (customer.uid !== user.uid) {
      throw new Error("Customer UID verification failed.");
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
        customer.businessName || "Customer Admin Panel";
    }

    const subscription = checkSubscription(customer);

    if ($("subscriptionStatus")) {
      $("subscriptionStatus").textContent =
        subscription.active ? "Active" : subscription.message;
    }

    showDashboard();

    showMessage(
      dashboardMessage,
      "Customer account verified successfully.",
      true
    );

    await showSection(
      subscription.active ? "overview" : "subscription"
    );

    showMessage(loginMessage, "");

  } catch (error) {
    console.error("Customer verification error:", error);

    resetCustomerData();
    showLogin();

    showMessage(
      loginMessage,
      error.message || "Customer verification failed."
    );

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
    const dateA = a.createdAt?.toDate
      ? a.createdAt.toDate().getTime()
      : 0;

    const dateB = b.createdAt?.toDate
      ? b.createdAt.toDate().getTime()
      : 0;

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
   DYNAMIC SPECIFICATIONS
   New array + old object support
===================================== */

function normalizeSpecifications(specifications) {
  if (Array.isArray(specifications)) {
    return specifications
      .map(item => ({
        label: String(item?.label || "").trim(),
        value: String(item?.value ?? "").trim()
      }))
      .filter(item => item.label && item.value);
  }

  if (specifications && typeof specifications === "object") {
    return Object.entries(specifications)
      .map(([label, value]) => ({
        label: String(label || "").trim(),
        value: String(value ?? "").trim()
      }))
      .filter(item => item.label && item.value);
  }

  return [];
}

function collectDynamicSpecifications() {
  const rows = [];

  document.querySelectorAll(".dynamic-specification-row")
    .forEach(row => {
      const label =
        row.querySelector("[data-spec-label]")?.value.trim() || "";

      const value =
        row.querySelector("[data-spec-value]")?.value.trim() || "";

      if (label && value) {
        rows.push({ label, value });
      }
    });

  return rows;
}

function addDynamicSpecificationRow(label = "", value = "") {
  const container = $("dynamicSpecificationRows");
  if (!container) return;

  const row = document.createElement("div");
  row.className = "dynamic-specification-row";

  row.innerHTML = `
    <div class="dynamic-specification-fields">

      <input
        type="text"
        data-spec-label
        value="${escapeHTML(label)}"
        placeholder="Specification name"
      >

      <textarea
        data-spec-value
        rows="2"
        placeholder="Specification value"
      >${escapeHTML(value)}</textarea>

      <button
        type="button"
        class="danger"
        data-remove-spec
      >Remove</button>

    </div>
  `;

  row.querySelector("[data-remove-spec]")?.addEventListener(
    "click",
    () => row.remove()
  );

  container.appendChild(row);
}

function renderDynamicSpecifications(specifications = []) {
  const container = $("dynamicSpecificationRows");
  if (!container) return;

  container.innerHTML = "";

  const rows = normalizeSpecifications(specifications);

  if (rows.length) {
    rows.forEach(item => {
      addDynamicSpecificationRow(item.label, item.value);
    });
  } else {
    addDynamicSpecificationRow();
  }
}

/* =====================================
   LOAD OCR LIBRARIES
===================================== */

function loadExternalScript(src, globalName) {
  return new Promise((resolve, reject) => {
    if (window[globalName]) {
      resolve(window[globalName]);
      return;
    }

    const existing = document.querySelector(
      `script[data-library="${globalName}"]`
    );

    if (existing) {
      existing.addEventListener("load", () => {
        if (window[globalName]) resolve(window[globalName]);
        else reject(new Error(`${globalName} load nahi hua.`));
      }, { once: true });

      existing.addEventListener("error", () => {
        reject(new Error(`${globalName} load nahi hua.`));
      }, { once: true });

      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.library = globalName;

    script.onload = () => {
      if (window[globalName]) resolve(window[globalName]);
      else reject(new Error(`${globalName} library unavailable.`));
    };

    script.onerror = () => {
      reject(new Error(`${globalName} library download failed.`));
    };

    document.head.appendChild(script);
  });
}

async function loadOCRLibraries() {
  if (ocrLibrariesPromise) return ocrLibrariesPromise;

  ocrLibrariesPromise = (async () => {
    const [tesseract, pdfjs] = await Promise.all([
      loadExternalScript(
        "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js",
        "Tesseract"
      ),
      loadExternalScript(
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
        "pdfjsLib"
      )
    ]);

    pdfjs.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    return { tesseract, pdfjs };
  })();

  try {
    return await ocrLibrariesPromise;
  } catch (error) {
    ocrLibrariesPromise = null;
    throw error;
  }
}

/* =====================================
   TEXT CLEANING
===================================== */

function normalizeOCRText(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[：]/g, ":")
    .replace(/[•●▪]/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanSpecificationText(value) {
  return String(value || "")
    .replace(/\*\*/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/^\s*[-:|]+\s*/, "")
    .replace(/\s*[-:|]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* =====================================
   IGNORE PDF FOOTERS / DISCLAIMERS
===================================== */

function isNonSpecificationLine(line) {
  const value = String(line || "").trim().toLowerCase();

  if (!value) return true;

  const ignoredPatterns = [
    /^casing and specifications are subject to change/i,
    /^specifications are subject to change/i,
    /^subject to change without prior notice/i,
    /^all rights reserved/i,
    /^copyright\b/i,
    /^www\./i,
    /^https?:\/\//i,
    /^page\s+\d+/i,
    /^\d+\s*\/\s*\d+$/,
    /^confidential\b/i,
    /^disclaimer\b/i,
    /^terms and conditions\b/i,
    /^[-_=*.\s]+$/
  ];

  return ignoredPatterns.some(pattern => pattern.test(value));
}

/* =====================================
   GENERIC SPECIFICATION PARSER
   No fixed specification names
===================================== */

function parseOCRProductDetails(rawText) {
  const text = normalizeOCRText(rawText);

  const lines = text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const result = {
    name: findTextValue(lines, [
      "Product Name",
      "Camera Name",
      "Model Name",
      "Product"
    ]),

    model: findTextValue(lines, [
      "Model Number",
      "Model No",
      "Model"
    ]),

    price: "",
    category: detectOCRCategory(text),

    description: findTextValue(lines, [
      "Description",
      "Product Description"
    ]),

    features: [],
    specifications: parseDynamicSpecifications(text)
  };

  // Model number detect
  const modelMatch = text.match(
    /\b[A-Z]{2,}(?:-[A-Z0-9]+){2,}\b/
  );

  if (modelMatch) {
    result.model = modelMatch[0];
  }

  // Price detect
  const rawPrice = findTextValue(lines, [
    "Selling Price",
    "Product Price",
    "MRP",
    "Price"
  ]);

  const priceMatch = rawPrice.match(/[\d,]+(?:\.\d+)?/);

  if (priceMatch) {
    result.price = priceMatch[0].replace(/,/g, "");
  }

  // Features detect
  const featureStart = lines.findIndex(line =>
    /^(features|key features|main features)/i.test(line)
  );

  if (featureStart >= 0) {
    for (
      let i = featureStart + 1;
      i < lines.length && result.features.length < 20;
      i++
    ) {
      const line = lines[i];

      if (/^(specifications|technical specifications|description)/i.test(line)) {
        break;
      }

      if (
        line.length > 2 &&
        line.length < 250 &&
        !isNonSpecificationLine(line)
      ) {
        result.features.push(
          line.replace(/^[-*•\d.)\s]+/, "").trim()
        );
      }
    }
  }

  // Product name detect
  if (!result.name) {
    const modelIndex = result.model
      ? lines.findIndex(line => line.includes(result.model))
      : -1;

    const candidates = modelIndex >= 0
      ? lines.slice(modelIndex + 1)
      : lines;

    const candidate = candidates.find(line =>
      line.length >= 5 &&
      line.length <= 120 &&
      /camera|dome|bullet|turret|wireless|network/i.test(line) &&
      !/think security|think cp plus|specification|features|www\.|https?:/i.test(line) &&
      !isNonSpecificationLine(line)
    );

    if (candidate) {
      result.name = candidate;
    }
  }

  return result;
}





function parseDynamicSpecifications(text) {

  const labels = [
    "Back Light Compensation",
    "Minimum Illumination",
    "Effective Pixels",
    "Angle Adjustment",
    "White Balance",
    "Shutter Speed",
    "DORI Distance",
    "Gain Control(AGC)",
    "Gain Control (AGC)",
    "Close Focus Distance",
    "Smart Illumination",
    "Video Compression",
    "Audio Compression",
    "Stream Capability",
    "Bit Rate Control",
    "Weatherproof Standard",
    "Operating Temperature",
    "Operating Humidity",
    "Storage Temperature",
    "Storage Humidity",
    "Power Consumption",
    "Power Source",
    "Cyber Security",
    "Mirror Function",
    "Motion Detection",
    "Privacy Mask",
    "Frame Rate",
    "Video Format",
    "Bit Rate",
    "Image Sensor",
    "Angle of View",
    "Lens Type",
    "Max. Aperture",
    "Lens Mount",
    "IR Number",
    "Warm Light",
    "IR Control",
    "Smart IR",
    "Noise Reduction",
    "Day/Night",
    "SDK and API",
    "User/Host",
    "Iris Control",
    "Certificates",
    "Published Date",
    "Resolution",
    "Protocol",
    "Ethernet",
    "Audio",
    "RAM",
    "ROM",
    "Lens",
    "IR",
    "S/N Ratio",
    "OSD",
    "ROI",
    "Browser",
    "Casing",
    "Weight",
    "Dimension",
    "Dimensions"
  ];

  const sortedLabels = [...labels].sort(
    (a, b) => b.length - a.length
  );

  const ignored = [
    /^think security/i,
    /^think cp plus/i,
    /^system overview/i,
    /^about cp plus/i,
    /^functions$/i,
    /^complete specification$/i,
    /^feature specification$/i,
    /^feature$/i,
    /^specification$/i,
    /^dimensions?\s*\(mm\/inch\)/i,
    /^page\s*\d+/i,
    /^www\./i,
    /^https?:\/\//i,
    /^email\s*:/i,
    /^phone\s*:/i,
    /^address\s*:/i,
    /^\*?\s*casing and specifications are subject/i
  ];

  const rows = [];
  let current = null;

  function clean(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/^[|:\s]+|[|:\s]+$/g, "")
      .trim();
  }

  function isIgnored(line) {
    if (!line) return true;

    return ignored.some(regex => regex.test(line));
  }

  function findLabel(line) {

    const normalized = clean(line);

    for (const label of sortedLabels) {

      const escaped = label.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const regex = new RegExp(
        "^" + escaped + "(?:\\s*:\\s*|\\s+)?(.*)$",
        "i"
      );

      const match = normalized.match(regex);

      if (match) {
        return {
          label: label,
          value: clean(match[1])
        };
      }
    }

    return null;
  }

  function addRow(label, value) {

    label = clean(label);
    value = clean(value);

    if (!label) return;

    // Ignore dimensions heading from PDF drawings
    if (
      /^dimensions?$/i.test(label) &&
      /^\(?mm\/inch\)?$/i.test(value)
    ) {
      return;
    }

    // Ignore marketing paragraph incorrectly read as Ethernet
    if (
      /^ethernet$/i.test(label) &&
      /cable to deliver|separate power adapters|cable clutter/i.test(value)
    ) {
      return;
    }

    const existing = rows.find(
      row => row.label.toLowerCase() === label.toLowerCase()
    );

    if (existing) {

      // Prefer a clean, shorter duplicate over a contaminated value
      const badWords =
        /think security|think cp plus|cable clutter|situational awareness/i;

      if (
        badWords.test(existing.value) ||
        (
          value.length < existing.value.length &&
          !badWords.test(value)
        )
      ) {
        existing.value = value;
      }

      current = existing;
      return;
    }

    current = {
      label: label,
      value: value
    };

    rows.push(current);
  }

  function appendValue(value) {

    value = clean(value);

    if (!current || !value || isIgnored(value)) return;

    // Do not add marketing paragraphs to specification values
    if (
      /think security|think cp plus|system overview|about cp plus/i.test(value)
    ) {
      return;
    }

    current.value = clean(
      current.value + " " + value
    );
  }

  let lines = String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n");

  // Fix common OCR cases where two specifications were merged
  const preparedLines = [];

  for (let line of lines) {

    line = clean(line);

    if (!line || isIgnored(line)) continue;

    // Split Power Source and Power Consumption
    if (
      /^Power Source\b/i.test(line) &&
      /\bBasic\s*:/i.test(line)
    ) {
      const parts = line.split(/\bBasic\s*:/i);

      preparedLines.push(parts[0].trim());

      preparedLines.push(
        "Power Consumption Basic: " +
        parts.slice(1).join(" Basic: ")
      );

      continue;
    }

    // Split Bit Rate and Protocol
    if (
      /^Bit Rate\b/i.test(line) &&
      /\bSFTP\s*,/i.test(line)
    ) {
      const parts = line.split(/\bSFTP\s*,/i);

      preparedLines.push(parts[0].trim());

      preparedLines.push(
        "Protocol SFTP, " +
        parts.slice(1).join(" SFTP, ")
      );

      continue;
    }

    // Split Back Light Compensation and Resolution
    if (
      /^Back Light Compensation\b/i.test(line) &&
      /\b4MP\s*\(/i.test(line)
    ) {
      const index = line.search(/\b4MP\s*\(/i);

      preparedLines.push(line.slice(0, index).trim());

      preparedLines.push(
        "Resolution " + line.slice(index).trim()
      );

      continue;
    }

    preparedLines.push(line);
  }

  for (let line of preparedLines) {

    line = clean(line);

    if (!line || isIgnored(line)) continue;

    // Remove Markdown table separator rows
    if (/^[-|:\s]+$/.test(line)) continue;

    // Remove table border characters
    line = line.replace(/^\|+|\|+$/g, "").trim();

    if (!line) continue;

    const found = findLabel(line);

    if (found) {

      // Skip drawing heading
      if (
        /^Dimensions?$/i.test(found.label) &&
        /^\(?mm\/inch\)?$/i.test(found.value)
      ) {
        current = null;
        continue;
      }

      addRow(found.label, found.value);
      continue;
    }

    // Support PDF table columns separated by tabs
    if (/\t/.test(line)) {

      const parts = line.split(/\t+/)
        .map(clean)
        .filter(Boolean);

      if (parts.length >= 2) {

        const labelPart = parts[0];
        const valuePart = parts.slice(1).join(" ");

        if (
          labelPart.length <= 55 &&
          !isIgnored(labelPart)
        ) {
          addRow(labelPart, valuePart);
          continue;
        }
      }
    }

    // Continue wrapped specification value
    appendValue(line);
  }

  // =========================================
  // REPAIR MERGED OCR SPECIFICATIONS
  // =========================================

  function getRow(label) {
    return rows.find(
      r => r.label.toLowerCase() === label.toLowerCase()
    );
  }

  function setRow(label, value) {
    let row = getRow(label);

    if (!row) {
      row = { label, value: "" };
      rows.push(row);
    }

    row.value = clean(value);
  }

  function removeRow(label) {
    const index = rows.findIndex(
      r => r.label.toLowerCase() === label.toLowerCase()
    );

    if (index !== -1) rows.splice(index, 1);
  }

  function splitAt(label, marker, newLabel) {
    const row = getRow(label);
    if (!row) return;

    const index = row.value.search(marker);
    if (index === -1) return;

    const first = row.value.slice(0, index);
    const second = row.value.slice(index);

    row.value = clean(first);

    const match = second.match(
      new RegExp("^" + marker.source, marker.flags)
    );

    if (match) {
      setRow(newLabel, second.replace(marker, "").trim());
    }
  }

  // 1. Back Light Compensation / Resolution
  splitAt(
    "Back Light Compensation",
    /\b4MP\s*\(/i,
    "Resolution"
  );

  // 2. Remove disclaimer from Resolution
  const resolution = getRow("Resolution");

  if (resolution) {
    resolution.value = resolution.value
      .replace(/\*?\s*Product casing and specifications.*$/i, "")
      .trim();
  }

  // 3. Stream Capability / Main Stream / Sub Streams
  const stream = getRow("Stream Capability");

  if (stream) {
    const value = stream.value;

    const mainIndex = value.search(/\bMain\s+stream\s*:/i);

    if (mainIndex !== -1) {
      stream.value = clean(value.slice(0, mainIndex));

      const remaining = value.slice(mainIndex);

      const sub1Index = remaining.search(/\bSub\s+stream\s*1\s*:/i);

      if (sub1Index !== -1) {
        const mainText = remaining.slice(0, sub1Index)
          .replace(/^Main\s+stream\s*:/i, "");

        const subRemaining = remaining.slice(sub1Index);

        const sub2Index = subRemaining.search(/\bSub\s+stream\s*2\s*:/i);

        if (sub2Index !== -1) {
          setRow("Main Stream", mainText);

          setRow(
            "Sub Stream 1",
            subRemaining.slice(0, sub2Index)
              .replace(/^Sub\s+stream\s*1\s*:/i, "")
          );

          setRow(
            "Sub Stream 2",
            subRemaining.slice(sub2Index)
              .replace(/^Sub\s+stream\s*2\s*:/i, "")
          );
        } else {
          setRow("Main Stream", mainText);
          setRow(
            "Sub Stream 1",
            subRemaining.replace(/^Sub\s+stream\s*1\s*:/i, "")
          );
        }
      }
    }
  }

  // 4. Move Frame Rate continuation into Sub Stream 1
  const frameRate = getRow("Frame Rate");

  if (frameRate) {
    const sub2Index = frameRate.value.search(
      /\bSub\s+stream\s*2\s*:/i
    );

    if (sub2Index !== -1) {
      const firstPart = clean(
        frameRate.value.slice(0, sub2Index)
      );

      const sub2Part = clean(
        frameRate.value.slice(sub2Index)
          .replace(/^Sub\s+stream\s*2\s*:/i, "")
      );

      const sub1 = getRow("Sub Stream 1");

      if (sub1) {
        sub1.value = clean(sub1.value + " " + firstPart);
      }

      setRow("Sub Stream 2", sub2Part);
      removeRow("Frame Rate");
    }
  }

  // 5. Bit Rate / Protocol
  splitAt(
    "Bit Rate",
    /\bSFTP\s*,/i,
    "Protocol"
  );

  // 6. Ethernet / Alarm Event / Cyber Security
  const ethernet = getRow("Ethernet");

  if (ethernet) {
    const marker = /\bNetwork disconnection\b/i;
    const index = ethernet.value.search(marker);

    if (index !== -1) {
      const original = ethernet.value;

      ethernet.value = clean(original.slice(0, index));

      const rest = original.slice(index);
      const securityIndex = rest.search(/\bAES\s+256-bit\s+Encryption\b/i);

      if (securityIndex !== -1) {
        setRow(
          "Alarm Event",
          rest.slice(0, securityIndex)
        );

        const securityText = rest.slice(securityIndex);
        const oldSecurity = getRow("Cyber Security");

        setRow(
          "Cyber Security",
          securityText + " " + (oldSecurity?.value || "")
        );
      } else {
        setRow("Alarm Event", rest);
      }
    }
  }

  // 7. Smart IR / Image Rotation
  splitAt(
    "Smart IR",
    /\b4MP\s+only\s+support\b/i,
    "Image Rotation"
  );

  // 8. Power Source / Power Consumption
  const powerSource = getRow("Power Source");

  if (powerSource) {
    const index = powerSource.value.search(/\bBasic\s*:/i);

    if (index !== -1) {
      const basic = powerSource.value.slice(index);

      powerSource.value = clean(
        powerSource.value.slice(0, index)
      );

      const powerConsumption = getRow("Power Consumption");

      setRow(
        "Power Consumption",
        basic + " " + (powerConsumption?.value || "")
      );
    }
  }

  // 9. Remove company details and disclaimer from Published Date
  const published = getRow("Published Date");

  if (published) {
    published.value = published.value
      .replace(/\*?\s*Product casing and specifications.*$/i, "")
      .replace(/\bCompany Name\b.*$/i, "")
      .replace(/\bContact Mail ID\b.*$/i, "")
      .trim();
  }

  // 10. Remove empty rows
  for (let i = rows.length - 1; i >= 0; i--) {
    if (!clean(rows[i].value)) {
      rows.splice(i, 1);
    }
  }

  // Final cleanup
  return rows
    .map(row => ({
      label: clean(row.label),
      value: clean(row.value)
    }))
    .filter(row => row.label && row.value)
    .filter(row => {
      if (
        /^dimensions?$/i.test(row.label) &&
        /^\(?mm\/inch\)?$/i.test(row.value)
      ) {
        return false;
      }

      return true;
    });
}

/* =====================================
   PDF.JS TABLE ROW RECONSTRUCTION
   Uses actual text positions
===================================== */

function reconstructPDFPageText(items) {
  const usableItems = items
    .filter(item => item.str && item.str.trim())
    .map(item => ({
      text: item.str.trim(),
      x: Number(item.transform?.[4] || 0),
      y: Number(item.transform?.[5] || 0),
      width: Number(item.width || 0)
    }))
    .sort((a, b) => {
      if (Math.abs(b.y - a.y) > 3) return b.y - a.y;
      return a.x - b.x;
    });
  
  const lines = [];
  
  for (const item of usableItems) {
    let line = lines.find(
      existing => Math.abs(existing.y - item.y) <= 3
    );
    
    if (!line) {
      line = { y: item.y, items: [] };
      lines.push(line);
    }
    
    line.items.push(item);
  }
  
  lines.sort((a, b) => b.y - a.y);
  
  return lines.map(line => {
    line.items.sort((a, b) => a.x - b.x);
    
    let output = "";
    let previous = null;
    
    for (const item of line.items) {
      if (previous) {
        const gap = item.x - (previous.x + previous.width);
        
        const previousCharWidth =
          previous.width / Math.max(previous.text.length, 1);
        
        const currentCharWidth =
          item.width / Math.max(item.text.length, 1);
        
        const averageCharWidth =
          (previousCharWidth + currentCharWidth) / 2;
        
        const columnGap = Math.max(
          10,
          averageCharWidth * 2.2
        );
        
        if (gap > columnGap) {
          output += "\t";
        } else if (gap > 2) {
          output += " ";
        }
      }
      
      output += item.text;
      previous = item;
    }
    
    return output.trim();
  }).filter(Boolean).join("\n");
}
/* =====================================
   OCR LANGUAGE FALLBACK
===================================== */

function formatTesseractWords(data) {
  const words = (data?.words || [])
    .filter(word =>
      word.text &&
      word.text.trim() &&
      word.bbox
    )
    .map(word => ({
      text: word.text.trim(),
      x0: Number(word.bbox.x0 || 0),
      x1: Number(word.bbox.x1 || 0),
      y: (
        Number(word.bbox.y0 || 0) +
        Number(word.bbox.y1 || 0)
      ) / 2
    }))
    .sort((a, b) => {
      if (Math.abs(a.y - b.y) > 8) {
        return a.y - b.y;
      }
      
      return a.x0 - b.x0;
    });
  
  if (!words.length) {
    return normalizeOCRText(data?.text || "");
  }
  
  const lines = [];
  
  for (const word of words) {
    let line = lines.find(
      item => Math.abs(item.y - word.y) <= 8
    );
    
    if (!line) {
      line = {
        y: word.y,
        words: []
      };
      
      lines.push(line);
    }
    
    line.words.push(word);
  }
  
  lines.sort((a, b) => a.y - b.y);
  
  return lines.map(line => {
    line.words.sort((a, b) => a.x0 - b.x0);
    
    let output = "";
    let previous = null;
    
    for (const word of line.words) {
      if (previous) {
        const gap = word.x0 - previous.x1;
        
        const previousWidth =
          (previous.x1 - previous.x0) /
          Math.max(previous.text.length, 1);
        
        const currentWidth =
          (word.x1 - word.x0) /
          Math.max(word.text.length, 1);
        
        const averageWidth =
          (previousWidth + currentWidth) / 2;
        
        const columnGap = Math.max(
          14,
          averageWidth * 2.5
        );
        
        output += gap > columnGap ? "\t" : " ";
      }
      
      output += word.text;
      previous = word;
    }
    
    return output.trim();
  }).filter(Boolean).join("\n");
}

async function recognizeWithFallback(
  source,
  onProgress,
  label = "Document"
) {
  const { tesseract } = await loadOCRLibraries();
  
  const languages = ["eng+hin", "eng"];
  
  let lastError = null;
  
  for (const language of languages) {
    try {
      onProgress?.(
        `${label}: ${language} OCR start ho raha hai...`
      );
      
      const result = await tesseract.recognize(
        source,
        language,
        {
          logger: message => {
            if (message.status === "recognizing text") {
              onProgress?.(
                `${label}: ${language} OCR ${Math.round(
                  (message.progress || 0) * 100
                )}%`
              );
            }
          }
        }
      );
      
      const formattedText = formatTesseractWords(
        result.data
      );
      
      const finalText = formattedText ||
        result.data?.text ||
        "";
      
      if (finalText.trim()) {
        return normalizeOCRText(finalText);
      }
      
    } catch (error) {
      lastError = error;
      
      console.warn(
        `OCR ${language} failed:`,
        error
      );
    }
  }
  
  if (lastError) {
    throw new Error(
      "Hindi + English aur English OCR dono fail hue: " +
      lastError.message
    );
  }
  
  return "";
}
/* =====================================
   IMAGE OCR
===================================== */

async function recognizeImageText(file, onProgress) {
  return recognizeWithFallback(
    file,
    onProgress,
    "Photo"
  );
}

/* =====================================
   PDF PAGE OCR
===================================== */

async function recognizePDFPage(page, onProgress, pageNumber) {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", {
    willReadFrequently: true
  });

  if (!context) {
    throw new Error("PDF canvas create nahi hua.");
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({
    canvasContext: context,
    viewport
  }).promise;

  const text = await recognizeWithFallback(
    canvas,
    onProgress,
    `PDF page ${pageNumber}`
  );

  canvas.width = 0;
  canvas.height = 0;

  return text;
}

/* =====================================
   PDF TEXT EXTRACTION
   Text layer first, OCR fallback
===================================== */

async function recognizePDF(file, onProgress) {
  const { pdfjs } = await loadOCRLibraries();

  const buffer = await file.arrayBuffer();

  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(buffer)
  }).promise;

  let fullText = "";

  if (!pdf.numPages) {
    throw new Error("PDF mein koi page nahi mila.");
  }

  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber++
  ) {
    onProgress?.(
      `PDF page ${pageNumber}/${pdf.numPages} read ho raha hai...`
    );

    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const pageText = reconstructPDFPageText(content.items || []);

    /* Text layer readable hai to usko use karein.
       Lekin text bahut kam ya empty hai to OCR chalega. */

    if (pageText.trim().length >= 30) {
      fullText += "\n" + pageText;
    } else {
      onProgress?.(
        `PDF page ${pageNumber} mein readable text kam hai. OCR chalu...`
      );

      const ocrText = await recognizePDFPage(
        page,
        onProgress,
        pageNumber
      );

      fullText += "\n" + (ocrText || pageText);
    }
  }

  return normalizeOCRText(fullText);
}

/* =====================================
   FILE VALIDATION
===================================== */

function validateOCRFile(file) {
  if (!file) {
    throw new Error("Pehle PDF ya photo select kijiye.");
  }

  const isPDF =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");

  const isImage = ALLOWED_OCR_IMAGE_TYPES.includes(file.type);

  if (!isPDF && !isImage) {
    throw new Error("PDF, JPG, PNG ya WEBP file select kijiye.");
  }

  if (file.size > MAX_OCR_FILE_BYTES) {
    throw new Error("OCR file 15 MB se chhoti honi chahiye.");
  }

  return isPDF ? "pdf" : "image";
}

/* =====================================
   OCR PRODUCT DETAILS
===================================== */

function findTextValue(lines, labels) {
  for (const line of lines) {
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const regex = new RegExp(
        "^" + escaped + "\\s*[:：-]\\s*(.+)$",
        "i"
      );

      const match = line.match(regex);

      if (match?.[1]?.trim()) {
        return match[1].trim();
      }
    }
  }

  return "";
}


function detectOCRCategory(text) {
  const value = String(text || "").toLowerCase();

  if (/bullet camera|bullet network camera/.test(value)) {
    return "CCTV Cameras";
  }

  if (/dome camera|turret camera/.test(value)) {
    return "CCTV Cameras";
  }

  if (/video door phone|video doorbell/.test(value)) {
    return "Video Door Phones";
  }

  if (/\bip camera\b|network camera/.test(value)) {
    return "IP Cameras";
  }

  if (/\bnvr\b/.test(value)) return "NVR";
  if (/\bdvr\b/.test(value)) return "DVR";

  return "";
}

/* =====================================
   FILL PRODUCT FORM
===================================== */

function fillProductFormFromOCR(parsed) {
  const setValue = (id, value) => {
    const field = $(id);

    if (field && value) {
      field.value = String(value).trim();
    }
  };

  setValue("productName", parsed.name);
  setValue("productModel", parsed.model);
  setValue("productPrice", parsed.price);
  setValue("productDescription", parsed.description);

  if (parsed.category) {
    const categorySelect = $("productCategory");

    const option = Array.from(categorySelect?.options || []).find(
      item => item.value.toLowerCase() === parsed.category.toLowerCase()
    );

    if (option) {
      categorySelect.value = option.value;
    }
  }

  if (parsed.features?.length) {
    const field = $("productFeatures");

    if (field) {
      const existing = field.value
        .split("\n")
        .map(x => x.trim())
        .filter(Boolean);

      field.value = [
        ...new Set([...existing, ...parsed.features])
      ].join("\n");
    }
  }

  if (parsed.specifications?.length) {
    renderDynamicSpecifications(parsed.specifications);
  }
}

/* =====================================
   OCR SCAN HANDLER
   Same PDF field also works for brochure
===================================== */

async function scanProductDocument() {
  const ocrInput = $("productOCRFile");
  const brochureInput = $("productPDFFile");

  const button = $("scanOCRBtn");
  const status = $("ocrStatus");
  const resultBox = $("ocrExtractedText");

  /* First use OCR input.
     If empty, use the brochure PDF input. */

  const file =
    ocrInput?.files?.[0] ||
    brochureInput?.files?.[0];

  if (!file) {
    if (status) {
      status.textContent =
        "Pehle Product PDF ya OCR PDF/Photo select kijiye.";
    }

    return;
  }

  const originalText = button?.textContent || "Scan & Auto Fill";

  try {
    const type = validateOCRFile(file);

    if (button) {
      button.disabled = true;
      button.textContent = "Scanning...";
    }

    if (status) {
      status.textContent = "OCR start ho raha hai...";
    }

    if (resultBox) {
      resultBox.style.display = "block";
      resultBox.value = "";
    }

    const progress = message => {
      if (status) status.textContent = message;
    };

    const text = type === "pdf"
      ? await recognizePDF(file, progress)
      : await recognizeImageText(file, progress);

    if (!text.trim()) {
      throw new Error(
        "PDF se text nahi mila. PDF scanned, protected ya image-only ho sakti hai."
      );
    }

    if (resultBox) {
      resultBox.value = text;
      resultBox.style.display = "block";
    }

    const parsed = parseOCRProductDetails(text);
console.log("OCR total characters:", text.length);
console.log("OCR parsed specifications:", parsed.specifications);
    fillProductFormFromOCR(parsed);

    if (status) {
      status.textContent =
        `OCR complete! ${parsed.specifications.length} dynamic specifications identify hui. Extracted text check kijiye.`;
    }

    console.log("OCR extracted text:", text);
    console.log("OCR specifications:", parsed.specifications);

  } catch (error) {
    console.error("OCR error:", error);

    if (status) {
      status.textContent =
        error.message || "OCR scan failed.";
    }

    if (resultBox) {
      resultBox.style.display = "block";
      resultBox.value =
        "OCR ERROR: " + (error.message || "Unknown error");
    }

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

/* =====================================
   CLOUDINARY IMAGE UPLOAD
===================================== */

async function uploadProductImage(file) {
  if (!file) return "";

  if (!ALLOWED_PRODUCT_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Sirf JPG, PNG ya WEBP photo upload kijiye.");
  }

  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    throw new Error("Photo ka size 5 MB se kam hona chahiye.");
  }

  const status = $("imageUploadStatus");

  if (status) {
    status.textContent = "Photo Cloudinary par upload ho rahi hai...";
  }

  const formData = new FormData();

  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", CLOUDINARY_PRODUCT_FOLDER);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.secure_url) {
    console.error("Cloudinary image upload:", result);

    throw new Error(
      result.error?.message ||
      "Photo upload nahi hui. Cloudinary unsigned preset check kijiye."
    );
  }

  if (status) {
    status.textContent = "Photo upload successful.";
  }

  return result.secure_url;
}

/* =====================================
   CLOUDINARY PDF UPLOAD
===================================== */

async function uploadProductPDF(file) {
  if (!file) return null;

  const isPDF =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");

  if (!isPDF) {
    throw new Error("Product brochure ke liye PDF file select kijiye.");
  }

  if (file.size > MAX_PRODUCT_PDF_BYTES) {
    throw new Error("PDF ka size 15 MB se kam hona chahiye.");
  }

  const status = $("productPDFStatus");

  if (status) {
    status.textContent = "PDF Cloudinary par upload ho rahi hai...";
  }

  const formData = new FormData();

  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", CLOUDINARY_PRODUCT_FOLDER);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`,
    {
      method: "POST",
      body: formData
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.secure_url) {
    console.error("Cloudinary PDF upload:", result);

    throw new Error(
      result.error?.message ||
      "PDF upload nahi hui. Cloudinary preset mein PDF/raw upload permission enable kijiye."
    );
  }

  if (status) {
    status.textContent = "PDF upload successful.";
  }

  return {
    url: result.secure_url,
    name: file.name
  };
}

/* =====================================
   PRODUCT FORM HTML
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
    : String(product.features || "");

  return `
    <h2>${product.id ? "Edit Product" : "Add New Product"}</h2>

    <form id="productForm">

      <h3>Product Information</h3>

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
          <input id="productPrice"
            type="number"
            min="0"
            step="0.01"
            value="${escapeHTML(product.price ?? "")}">
        </div>

      </div>

      <hr>

      <h3>Product Photo</h3>

      <label for="productImageFile">Product Photo</label>

      <input id="productImageFile"
        type="file"
        accept="image/jpeg,image/png,image/webp">

      <small class="muted">
        JPG, PNG ya WEBP. Maximum 5 MB.
      </small>

      <div style="margin:12px 0;">

        <img id="productImagePreview"
          src="${escapeHTML(product.imageUrl || "")}"
          alt="Product photo preview"
          style="
            display:${product.imageUrl ? "block" : "none"};
            max-width:180px;
            max-height:150px;
            object-fit:contain;
            border:1px solid #e2e8f0;
            border-radius:8px;
            padding:5px;
          ">

      </div>

      <label for="productImage">
        Existing Image URL (optional)
      </label>

      <input id="productImage"
        type="url"
        value="${escapeHTML(product.imageUrl || "")}"
        placeholder="Optional image URL">

      <p id="imageUploadStatus"
        class="muted"
        aria-live="polite"></p>

      <hr>

      <h3>Product PDF Brochure / Datasheet</h3>

      ${
        product.pdfUrl
          ? `
            <p>
              Existing PDF:
              <a href="${escapeHTML(product.pdfUrl)}"
                target="_blank"
                rel="noopener">
                ${escapeHTML(product.pdfName || "View existing PDF")}
              </a>
            </p>
          `
          : `<p class="muted">Abhi koi PDF brochure upload nahi hai.</p>`
      }

      <label for="productPDFFile">
        Upload Product PDF
      </label>

      <input id="productPDFFile"
        type="file"
        accept=".pdf,application/pdf">

      <small class="muted">
        PDF maximum 15 MB. Original PDF product ke saath save hoga.
        Isi PDF ko OCR scanner bhi read karega.
      </small>

      <p id="productPDFStatus"
        class="muted"
        aria-live="polite"></p>

      <hr>

      <h3>Hindi + English OCR Scanner</h3>

      <p class="muted">
        Product PDF ya photo scan karke product details aur
        specifications automatically nikaaliye.
      </p>

      <label for="productOCRFile">
        OCR PDF / Photo (optional)
      </label>

      <input id="productOCRFile"
        type="file"
        accept=".pdf,application/pdf,image/jpeg,image/png,image/webp">

      <small class="muted">
        PDF, JPG, PNG, WEBP. Maximum 15 MB.
        Agar yahan file select nahi karenge toh upar wali Product PDF scan hogi.
      </small>

      <button class="secondary"
        type="button"
        id="scanOCRBtn"
        style="margin-top:12px;">
        Scan & Auto Fill
      </button>

      <p id="ocrStatus"
        class="muted"
        aria-live="polite"></p>

      <label for="ocrExtractedText">
        Extracted OCR Text
      </label>

      <textarea id="ocrExtractedText"
        rows="8"
        readonly
        style="display:none;width:100%;"></textarea>

      <hr>

      <h3>Description</h3>

      <textarea id="productDescription">${escapeHTML(product.description || "")}</textarea>

      <label>Features (one per line)</label>

      <textarea id="productFeatures">${escapeHTML(features)}</textarea>

      <hr>

      <h3>Technical Specifications</h3>

      <p class="muted">
        PDF se mili specifications yahan automatically aayengi.
        Aap label aur value edit kar sakte hain.
        Zaroorat ke mutabik nayi row bhi jod sakte hain.
      </p>

      <div id="dynamicSpecificationRows"></div>

      <button type="button"
        class="secondary"
        id="addDynamicSpecificationBtn">
        + Add Specification
      </button>

      <hr>

      <div class="checkbox-row">

        <label>
          <input type="checkbox"
            id="productNew"
            ${product.isNew ? "checked" : ""}>
          New Product
        </label>

        <label>
          <input type="checkbox"
            id="productTrending"
            ${product.trending ? "checked" : ""}>
          Trending
        </label>

        <label>
          <input type="checkbox"
            id="productActive"
            ${product.active !== false ? "checked" : ""}>
          Active
        </label>

      </div>

      <button class="primary"
        id="saveProductBtn"
        data-original-label="${product.id ? "Update Product" : "Save Product"}"
        type="submit">

        ${product.id ? "Update Product" : "Save Product"}

      </button>

      <button class="secondary"
        type="button"
        id="cancelProduct">
        Cancel
      </button>

    </form>
  `;
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

  const saveButton = $("saveProductBtn");

  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "Please wait...";
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

    const existing = editingProductId
      ? currentProducts.find(item => item.id === editingProductId)
      : null;

    if (
      editingProductId &&
      (!existing || existing.customerId !== currentCustomer.id)
    ) {
      throw new Error("Aap is product ko edit nahi kar sakte.");
    }

    /* IMAGE */

    let imageUrl = $("productImage").value.trim();

    if ($("productImageFile")?.files?.[0]) {
      imageUrl = await uploadProductImage(
        $("productImageFile").files[0]
      );

      $("productImage").value = imageUrl;

    } else if (!imageUrl && existing?.imageUrl) {
      imageUrl = existing.imageUrl;
    }

    /* PDF */

    let pdfUrl = existing?.pdfUrl || "";
    let pdfName = existing?.pdfName || "";

    const pdfFile = $("productPDFFile")?.files?.[0];

    if (pdfFile) {
      const uploadedPDF = await uploadProductPDF(pdfFile);

      pdfUrl = uploadedPDF.url;
      pdfName = uploadedPDF.name;
    }

    /* FEATURES */

    const features = $("productFeatures").value
      .split("\n")
      .map(item => item.trim())
      .filter(Boolean);

    /* DYNAMIC SPECIFICATIONS */

    const specifications = collectDynamicSpecifications();

    const productData = {
      customerId: currentCustomer.id,
      customerUid: currentUser.uid,

      name,
      category,
      model: $("productModel").value.trim(),
      price,

      imageUrl,

      pdfUrl,
      pdfName,

      description: $("productDescription").value.trim(),
      features,
      specifications,

      isNew: $("productNew").checked,
      trending: $("productTrending").checked,
      active: $("productActive").checked,

      updatedAt: serverTimestamp()
    };

    showMessage(
      dashboardMessage,
      "Saving product details..."
    );

    if (editingProductId) {
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
      "Product, specifications and PDF successfully saved.",
      true
    );

    showProducts();

  } catch (error) {
    console.error("Product save error:", error);

    showMessage(
      dashboardMessage,
      error.message || "Product save nahi hua."
    );

  } finally {
    if (saveButton) {
      saveButton.disabled = false;

      saveButton.textContent =
        saveButton.dataset.originalLabel || "Save Product";
    }
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

    if (!product || product.customerId !== currentCustomer.id) {
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
   VIEW PRODUCT DETAILS
===================================== */

function closeProductDetails() {
  document.getElementById("productDetailsModal")?.remove();
}

function viewProductDetails(productId) {
  const product = currentProducts.find(
    item => item.id === productId
  );

  if (!product) {
    alert("Product details nahi mile.");
    return;
  }

  if (
    !currentCustomer ||
    product.customerId !== currentCustomer.id
  ) {
    alert("Aap is product ko view nahi kar sakte.");
    return;
  }

  closeProductDetails();

  const hiddenFields = [
    "id",
    "customerId",
    "customerUid",
    "uid",
    "createdAt",
    "updatedAt",
    "timestamp",
    "imageUrl",
    "pdfUrl",
    "pdfName",
    "features",
    "specifications"
  ];

  function makeLabel(key) {
    return String(key)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  function formatValue(value) {
    if (value === null || value === undefined) return "";

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    if (Array.isArray(value)) {
      return value.map(item =>
        typeof item === "object"
          ? JSON.stringify(item)
          : String(item)
      ).filter(Boolean).join(", ");
    }

    if (typeof value === "object") {
      return Object.entries(value)
        .map(([key, val]) =>
          `${makeLabel(key)}: ${String(val)}`
        )
        .join(" | ");
    }

    return String(value).trim();
  }

  const generalRows = Object.entries(product)
    .filter(([key, value]) => {
      if (hiddenFields.includes(key)) return false;
      if (value === null || value === undefined) return false;

      if (
        typeof value === "string" &&
        !value.trim()
      ) return false;

      if (
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0
      ) return false;

      return true;
    })
    .map(([key, value]) => `
      <tr>
        <th>${escapeHTML(makeLabel(key))}</th>
        <td>${escapeHTML(formatValue(value))}</td>
      </tr>
    `).join("");

  const features = Array.isArray(product.features)
    ? product.features
    : String(product.features || "").split("\n");

  const featuresHTML = features
    .map(item => String(item).trim())
    .filter(Boolean)
    .map(item => `<li>${escapeHTML(item)}</li>`)
    .join("");

  const specifications = normalizeSpecifications(
    product.specifications
  );

  const specificationRows = specifications.map(item => `
    <tr>
      <th>${escapeHTML(item.label)}</th>
      <td>${escapeHTML(item.value)}</td>
    </tr>
  `).join("");

  const pdfHTML = product.pdfUrl
    ? `
      <div class="product-details-pdf">
        <h3>Product PDF Brochure / Datasheet</h3>

        <p>
          ${escapeHTML(product.pdfName || "Product Datasheet PDF")}
        </p>

        <a href="${escapeHTML(product.pdfUrl)}"
          target="_blank"
          rel="noopener">
          Open / View PDF
        </a>
      </div>
    `
    : "";

  const modal = document.createElement("div");
  modal.id = "productDetailsModal";

  modal.innerHTML = `
    <div class="product-details-overlay">

      <div class="product-details-box">

        <button class="product-details-close"
          type="button"
          data-close-details>
          &times;
        </button>

        <h2>Complete Product Details</h2>

        ${
          product.imageUrl
            ? `
              <div class="product-details-image">
                <img src="${escapeHTML(product.imageUrl)}"
                  alt="${escapeHTML(product.name || "Product")}">
              </div>
            `
            : ""
        }

        <h3>${escapeHTML(product.name || "Product")}</h3>

        ${
          generalRows
            ? `
              <h3>Product Information</h3>

              <div class="product-details-table-wrap">
                <table class="product-details-table">
                  <tbody>${generalRows}</tbody>
                </table>
              </div>
            `
            : ""
        }

        ${
          featuresHTML
            ? `
              <h3>Features</h3>
              <ul class="product-details-features">
                ${featuresHTML}
              </ul>
            `
            : ""
        }

        ${
          specificationRows
            ? `
              <h3>Complete Specification</h3>

              <div class="product-details-table-wrap">
                <table class="product-details-table">
                  <tbody>${specificationRows}</tbody>
                </table>
              </div>
            `
            : "<p>No specifications added.</p>"
        }

        ${pdfHTML}

        <button type="button"
          class="product-details-bottom-close"
          data-close-details>
          Close
        </button>

      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelectorAll("[data-close-details]").forEach(button => {
    button.addEventListener("click", closeProductDetails);
  });

  modal.addEventListener("click", event => {
    if (
      event.target.classList.contains("product-details-overlay")
    ) {
      closeProductDetails();
    }
  });

  function escapeHandler(event) {
    if (event.key === "Escape") {
      closeProductDetails();
      document.removeEventListener("keydown", escapeHandler);
    }
  }

  document.addEventListener("keydown", escapeHandler);
}

/* =====================================
   SHOW PRODUCTS
===================================== */

function showProducts() {
  const productCards = currentProducts.map(product => `
    <article class="product">

      ${
        product.imageUrl
          ? `
            <img
              src="${escapeHTML(product.imageUrl)}"
              alt="${escapeHTML(product.name || "Product")}"
              onerror="this.style.display='none'"
            >
          `
          : ""
      }

      <h3>${escapeHTML(product.name || "-")}</h3>

      <p>
        <b>Category:</b>
        ${escapeHTML(product.category || "-")}
      </p>

      <p>
        <b>Model:</b>
        ${escapeHTML(product.model || "-")}
      </p>

      <p>
        <b>Price:</b>
        ${
          product.price === null ||
          product.price === undefined ||
          product.price === ""
            ? "Not set"
            : "₹" + escapeHTML(product.price)
        }
      </p>

      <p>
        <b>Status:</b>
        ${product.active === false ? "Inactive" : "Active"}
      </p>

      <p>
        <b>Specifications:</b>
        ${normalizeSpecifications(product.specifications).length}
      </p>

      <p>
        <b>PDF:</b>
        ${product.pdfUrl ? "Uploaded" : "Not uploaded"}
      </p>

      <button type="button"
        class="secondary"
        data-view="${escapeHTML(product.id)}">
        View Details
      </button>

      <button type="button"
        class="primary"
        data-edit="${escapeHTML(product.id)}">
        Edit
      </button>

      <button type="button"
        class="danger"
        data-delete="${escapeHTML(product.id)}">
        Delete
      </button>

    </article>
  `).join("");

  sectionContent.innerHTML = `
    <h2>My Products</h2>

    <p class="muted">
      Add and manage your business products.
    </p>

    <button type="button"
      class="primary"
      id="addProductBtn">
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

    renderDynamicSpecifications([]);
    attachProductFormEvents();

    $("productFormArea").scrollIntoView({
      behavior: "smooth"
    });
  });

  sectionContent.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", () => {
      viewProductDetails(button.dataset.view);
    });
  });

  sectionContent.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => {
      const product = currentProducts.find(
        item => item.id === button.dataset.edit
      );

      if (!product) return;

      editingProductId = product.id;

      $("productFormArea").innerHTML = productFormHTML(product);

      renderDynamicSpecifications(
        product.specifications || []
      );

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

/* =====================================
   PRODUCT FORM EVENTS
===================================== */

function attachProductFormEvents() {
  $("productForm")?.addEventListener(
    "submit",
    saveProduct
  );

  $("scanOCRBtn")?.addEventListener(
    "click",
    scanProductDocument
  );

  $("addDynamicSpecificationBtn")?.addEventListener(
    "click",
    () => addDynamicSpecificationRow()
  );

  $("productImageFile")?.addEventListener("change", event => {
    const file = event.target.files?.[0];
    const preview = $("productImagePreview");
    const status = $("imageUploadStatus");

    if (!file) return;

    if (!ALLOWED_PRODUCT_IMAGE_TYPES.includes(file.type)) {
      event.target.value = "";

      if (status) {
        status.textContent =
          "Sirf JPG, PNG ya WEBP photo select kijiye.";
      }

      return;
    }

    if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
      event.target.value = "";

      if (status) {
        status.textContent =
          "Photo ka size 5 MB se kam hona chahiye.";
      }

      return;
    }

    if (preview) {
      if (preview.dataset.objectUrl) {
        URL.revokeObjectURL(preview.dataset.objectUrl);
      }

      const objectUrl = URL.createObjectURL(file);

      preview.dataset.objectUrl = objectUrl;
      preview.src = objectUrl;
      preview.style.display = "block";
    }

    if (status) {
      status.textContent =
        "Photo ready hai. Save Product dabakar upload karein.";
    }
  });

  $("productPDFFile")?.addEventListener("change", event => {
    const file = event.target.files?.[0];
    const status = $("productPDFStatus");

    if (!file) return;

    const isPDF =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPDF) {
      event.target.value = "";

      if (status) {
        status.textContent = "Sirf PDF file select kijiye.";
      }

      return;
    }

    if (file.size > MAX_PRODUCT_PDF_BYTES) {
      event.target.value = "";

      if (status) {
        status.textContent =
          "PDF ka size 15 MB se kam hona chahiye.";
      }

      return;
    }

    if (status) {
      status.textContent =
        `${file.name} ready hai. Scan & Auto Fill dabakar isi PDF ko scan kar sakte hain. Save Product karne par upload hogi.`;
    }
  });

  $("productOCRFile")?.addEventListener("change", event => {
    const file = event.target.files?.[0];
    const status = $("ocrStatus");

    if (!file) return;

    try {
      validateOCRFile(file);

      if (status) {
        status.textContent =
          `${file.name} ready hai. Scan & Auto Fill dabaiye.`;
      }

    } catch (error) {
      event.target.value = "";

      if (status) {
        status.textContent = error.message;
      }
    }
  });

  $("cancelProduct")?.addEventListener("click", () => {
    editingProductId = null;

    const preview = $("productImagePreview");

    if (preview?.dataset.objectUrl) {
      URL.revokeObjectURL(preview.dataset.objectUrl);
    }

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

    if (!enquiry || enquiry.customerId !== currentCustomer.id) {
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
  const enquiryCards = currentEnquiries.map(enquiry => `
    <article class="product enquiry-card">

      <h3>
        ${escapeHTML(
          enquiry.productName ||
          enquiry.product ||
          "General Enquiry"
        )}
      </h3>

      <p>
        <b>Customer:</b>
        ${escapeHTML(enquiry.name || "Not provided")}
      </p>

      <p>
        <b>Email:</b>
        ${escapeHTML(enquiry.email || "Not provided")}
      </p>

      <p>
        <b>Phone:</b>
        ${escapeHTML(
          enquiry.mobile ||
          enquiry.phone ||
          "Not provided"
        )}
      </p>

      <p>
        <b>Company:</b>
        ${escapeHTML(enquiry.company || "-")}
      </p>

      <p>
        <b>Location:</b>
        ${escapeHTML([
          enquiry.city,
          enquiry.state,
          enquiry.country
        ].filter(Boolean).join(", ") || "-")}
      </p>

      <p>
        <b>Pincode:</b>
        ${escapeHTML(enquiry.pincode || "-")}
      </p>

      <p>
        <b>Model:</b>
        ${escapeHTML(enquiry.productModel || "-")}
      </p>

      <p>
        <b>Message:</b>
        ${escapeHTML(enquiry.message || "No message")}
      </p>

      <p>
        <b>Received:</b>
        ${escapeHTML(formatEnquiryDate(enquiry.createdAt))}
      </p>

      <p>
        <b>Status:</b>
        ${escapeHTML(enquiry.status || "new")}
      </p>

      <p>
        <b>Read:</b>
        ${enquiry.read === true ? "Yes" : "No"}
      </p>

      ${
        enquiry.read === true
          ? `
            <button class="secondary" disabled>
              Already Read
            </button>
          `
          : `
            <button class="primary"
              type="button"
              data-enquiry-read="${escapeHTML(enquiry.id)}">
              Mark as Read
            </button>
          `
      }

    </article>
  `).join("");

  sectionContent.innerHTML = `
    <h2>Customer Enquiries</h2>

    <p class="muted">
      Website par aapke products ke liye aayi enquiries yahan dikhengi.
    </p>

    <p>
      <b>Total Enquiries:</b>
      ${currentEnquiries.length}
    </p>

    <button class="secondary"
      id="refreshEnquiriesBtn"
      type="button">
      Refresh Enquiries
    </button>

    <div class="product-list">
      ${enquiryCards || "<p>Abhi tak koi enquiry nahi aayi hai.</p>"}
    </div>
  `;

  $("refreshEnquiriesBtn")?.addEventListener(
    "click",
    async () => {
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
    }
  );

  sectionContent.querySelectorAll("[data-enquiry-read]")
    .forEach(button => {
      button.addEventListener("click", () => {
        markEnquiryAsRead(button.dataset.enquiryRead);
      });
    });
}

/* =====================================
   SUBSCRIPTION RENEWAL HELPERS
===================================== */

const RENEWAL_UPI_ID = "9353689775@upi";

function getExpiryDate(customer) {
  const expiry = customer?.subscriptionExpiry;

  if (!expiry) return null;

  const date = typeof expiry.toDate === "function"
    ? expiry.toDate()
    : new Date(expiry);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getRenewalStatus() {
  return checkSubscription(currentCustomer);
}

async function copyRenewalUPI() {
  try {
    await navigator.clipboard.writeText(RENEWAL_UPI_ID);

    showMessage(
      dashboardMessage,
      "UPI ID copied successfully.",
      true
    );

  } catch (error) {
    showMessage(
      dashboardMessage,
      "UPI ID copy nahi hua. Manually copy kijiye."
    );
  }
}

async function loadSubscriptionRequests() {
  if (!currentUser || !currentCustomer) return [];

  const requestsQuery = query(
    collection(db, "subscriptionRequests"),
    where("customerUid", "==", currentUser.uid)
  );

  const snapshot = await getDocs(requestsQuery);

  const requests = snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));

  requests.sort((a, b) => {
    const dateA = a.createdAt?.toDate
      ? a.createdAt.toDate().getTime()
      : 0;

    const dateB = b.createdAt?.toDate
      ? b.createdAt.toDate().getTime()
      : 0;

    return dateB - dateA;
  });

  return requests;
}

async function submitRenewalRequest(event) {
  event.preventDefault();

  if (!currentUser || !currentCustomer) {
    showMessage(dashboardMessage, "Customer login required.");
    return;
  }

  const utr = $("renewalUTR")?.value.trim() || "";
  const submitButton = $("submitRenewalBtn");

  if (utr.length < 6 || utr.length > 50) {
    showMessage(
      dashboardMessage,
      "Valid UTR enter kijiye (6–50 characters)."
    );
    return;
  }

  const amount = Number(currentCustomer.subscriptionAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    showMessage(
      dashboardMessage,
      "Subscription amount valid nahi hai. Admin se contact kijiye."
    );
    return;
  }

  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
    }

    const existingRequests = await loadSubscriptionRequests();

    const pendingRequest = existingRequests.find(
      request =>
        String(request.status || "").toLowerCase() === "pending"
    );

    if (pendingRequest) {
      throw new Error(
        "Aapki renewal request pehle se Pending hai. Admin ke response ka wait kijiye."
      );
    }

    await addDoc(
      collection(db, "subscriptionRequests"),
      {
        customerId: currentCustomer.id,
        customerUid: currentUser.uid,

        businessName:
          currentCustomer.businessName ||
          currentCustomer.ownerName ||
          "Customer",

        plan: currentCustomer.plan || "monthly",
        amount,
        utr,

        paymentMethod: "UPI",
        upiId: RENEWAL_UPI_ID,

        status: "pending",
        createdAt: serverTimestamp()
      }
    );

    showMessage(
      dashboardMessage,
      "Renewal request successfully submitted.",
      true
    );

    await showSection("subscription");

  } catch (error) {
    console.error("Renewal submission error:", error);

    showMessage(
      dashboardMessage,
      error.message || "Renewal request submit nahi hui."
    );

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Submit Renewal Request";
    }
  }
}

/* =====================================
   RENEWAL HISTORY
===================================== */

async function renderRenewalHistory() {
  const history = $("renewalHistory");
  if (!history) return;

  try {
    const requests = await loadSubscriptionRequests();

    history.innerHTML = requests.length
      ? requests.map(request => {
          const date = request.createdAt?.toDate
            ? request.createdAt.toDate().toLocaleString("en-IN")
            : "Recently submitted";

          const status = String(
            request.status || "pending"
          ).toUpperCase();

          return `
            <article class="product">

              <p>
                <b>Amount:</b>
                ₹${escapeHTML(request.amount ?? "-")}
              </p>

              <p>
                <b>UTR:</b>
                ${escapeHTML(request.utr || "-")}
              </p>

              <p>
                <b>Date:</b>
                ${escapeHTML(date)}
              </p>

              <p>
                <b>Status:</b>
                ${escapeHTML(status)}
              </p>

            </article>
          `;
        }).join("")
      : "<p>No renewal requests submitted yet.</p>";

  } catch (error) {
    console.error("Renewal history error:", error);

    history.textContent =
      "Renewal history load nahi hui: " + error.message;
  }
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

  /* OVERVIEW */

  if (section === "overview") {
    sectionContent.innerHTML = `
      <h2>Overview</h2>
      <p>Dashboard information load ho rahi hai...</p>
    `;

    try {
      ensureActiveSubscription();

      const results = await Promise.allSettled([
        loadProducts(),
        loadCustomerEnquiries()
      ]);

      const productResult = results[0];
      const enquiryResult = results[1];

      await updateDashboardCounts();

      sectionContent.innerHTML = `
        <h2>Overview</h2>

        <p>
          Welcome to your RB Tech Solution Customer Admin Panel.
        </p>

        <p>
          Total products:
          <b>${currentProducts.length}</b>
        </p>

        <p>
          Total enquiries:
          <b>${currentEnquiries.length}</b>
        </p>

        <p>
          Subscription:
          <b>Active</b>
        </p>

        ${
          productResult.status === "rejected"
            ? `
              <p class="message">
                ${escapeHTML(
                  productResult.reason?.message ||
                  "Products load failed."
                )}
              </p>
            `
            : ""
        }

        ${
          enquiryResult.status === "rejected"
            ? `
              <p class="message">
                ${escapeHTML(
                  enquiryResult.reason?.message ||
                  "Enquiries load failed."
                )}
              </p>
            `
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

  /* PRODUCTS */

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

        <p>
          ${escapeHTML(
            error.message || "Products load nahi hue."
          )}
        </p>
      `;
    }

    return;
  }

  /* ENQUIRIES */

  if (section === "enquiries") {
    sectionContent.innerHTML = `
      <h2>Customer Enquiries</h2>
      <p>Enquiries load ho rahi hain...</p>
    `;

    try {
      ensureActiveSubscription();

      await loadCustomerEnquiries();
      await updateDashboardCounts();

      showEnquiries();

    } catch (error) {
      console.error("Enquiries loading error:", error);

      sectionContent.innerHTML = `
        <h2>Customer Enquiries</h2>

        <p class="message">
          ${escapeHTML(
            error.message || "Enquiries load nahi hui."
          )}
        </p>

        <button class="secondary"
          type="button"
          id="retryEnquiriesBtn">
          Try Again
        </button>
      `;

      $("retryEnquiriesBtn")?.addEventListener(
        "click",
        () => showSection("enquiries")
      );
    }

    return;
  }

  /* SUBSCRIPTION */

  if (section === "subscription") {
    const subscription = getRenewalStatus();
    const expiryDate = getExpiryDate(currentCustomer);

    const expiryText = expiryDate
      ? expiryDate.toLocaleDateString("en-IN")
      : "Not available";

    const amount = Number(currentCustomer.subscriptionAmount);

    const amountText = Number.isFinite(amount)
      ? amount.toLocaleString("en-IN")
      : "Not set";

    const statusText = subscription.active
      ? "Active"
      : subscription.message;

    sectionContent.innerHTML = `
      <h2>Subscription Details</h2>

      <div class="product">

        <p>
          <b>Plan:</b>
          ${escapeHTML(currentCustomer.plan || "-")}
        </p>

        <p>
          <b>Amount:</b>
          ₹${escapeHTML(amountText)}
        </p>

        <p>
          <b>Status:</b>
          ${escapeHTML(statusText)}
        </p>

        <p>
          <b>Expiry Date:</b>
          ${escapeHTML(expiryText)}
        </p>

      </div>

      <div class="product">

        <h3>Renew Subscription</h3>

        <p>
          Apne subscription ko renew karne ke liye
          neeche diye gaye UPI ID par payment kijiye.
        </p>

        <p><b>UPI ID:</b></p>

        <input id="renewalUPI"
          value="${RENEWAL_UPI_ID}"
          readonly>

        <button class="secondary"
          type="button"
          id="copyRenewalUPI">
          Copy UPI ID
        </button>

        <p>
          <b>Payment Amount:</b>
          ₹${escapeHTML(amountText)}
        </p>

        <p class="muted">
          Payment karne ke baad UTR / Transaction Reference
          Number submit kijiye. Admin payment verify karne ke
          baad request approve karega.
        </p>

        <form id="renewalForm">

          <label for="renewalUTR">
            UTR / Transaction Reference Number *
          </label>

          <input id="renewalUTR"
            type="text"
            minlength="6"
            maxlength="50"
            required
            placeholder="Enter payment UTR number">

          <button class="primary"
            type="submit"
            id="submitRenewalBtn">
            Submit Renewal Request
          </button>

        </form>

      </div>

      <div class="product">

        <h3>Renewal Request History</h3>

        <div id="renewalHistory">
          Loading renewal requests...
        </div>

      </div>
    `;

    $("copyRenewalUPI")?.addEventListener(
      "click",
      copyRenewalUPI
    );

    $("renewalForm")?.addEventListener(
      "submit",
      submitRenewalRequest
    );

    await renderRenewalHistory();

    return;
  }

  /* MARKETING SECTIONS */

  const marketingSections = [
    "companyNews",
    "brochures",
    "videos",
    "gallery",
    "printPress"
  ];

  if (marketingSections.includes(section)) {
    try {
      ensureActiveSubscription();

      await renderMarketingAdmin(
        sectionContent,
        currentCustomer,
        section
      );

    } catch (error) {
      console.error("Marketing section error:", error);

      sectionContent.innerHTML = `
        <h2>Marketing Content</h2>

        <p class="message">
          ${escapeHTML(
            error.message ||
            "Marketing section open nahi hua."
          )}
        </p>
      `;
    }

    return;
  }

  sectionContent.innerHTML = `
    <h2>Section Not Found</h2>
    <p>Selected section available nahi hai.</p>
  `;
}

/* =====================================
   LOGIN HANDLER
===================================== */

loginForm?.addEventListener("submit", async event => {
  event.preventDefault();

  const email = $("email")?.value.trim() || "";
  const password = $("password")?.value || "";

  const submitButton = loginForm.querySelector(
    'button[type="submit"]'
  );

  if (!email || !password) {
    showMessage(
      loginMessage,
      "Email aur password enter kijiye."
    );

    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Logging in...";
  }

  showMessage(
    loginMessage,
    "Connecting to Firebase..."
  );

  try {
    await authReady;

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

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
      if (!user) {
        resetCustomerData();
        showLogin();
        return;
      }

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
