
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
   Product Management + Hindi/English OCR
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
let ocrLibrariesPromise = null;

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
   SPECIFICATION FIELD LIST
===================================== */

const SPECIFICATION_FIELDS = [
  "Image Sensor",
  "Minimum Illumination",
  "Effective Pixels",
  "Shutter Speed",
  "Angle Adjustment",
  "ROM",
  "White Balance",
  "Image Setting",
  "Lens Type",
  "Max. Aperture",
  "Lens Mount",
  "Smart IR",
  "IR Number",
  "IR",
  "Day/Night",
  "Close Focus Distance",
  "DORI Distance",
  "Gain Control (AGC)",
  "Lens",
  "Video Compression",
  "Back Light Compensation",
  "S/N Ratio",
  "Angle of view",
  "Stream Capability",
  "Frame Rate",
  "Resolution",
  "Noise Reduction",
  "Defog",
  "Privacy Mask",
  "Audio",
  "Audio Compression",
  "OSD",
  "Bit Rate Control",
  "Bit Rate",
  "Protocol",
  "Video Format",
  "SDK and API",
  "Event Alarm",
  "Cyber Security",
  "Device Search Tool",
  "OTA (Over-The-Air)",
  "Audio Sampling Rate",
  "Image Flip",
  "Iris Control",
  "Browser",
  "User/Host",
  "Ethernet",
  "Storage",
  "Power Source",
  "Power Consumption",
  "Operating Temperature",
  "Operating Humidity",
  "Storage Temperature",
  "Storage Humidity",
  "Certificates",
  "Casing",
  "Dimensions",
  "Weight"
];

const LONG_SPECIFICATION_FIELDS = [
  "DORI Distance",
  "Frame Rate",
  "Video Compression",
  "Protocol",
  "Event Alarm",
  "Cyber Security",
  "Power Consumption",
  "Certificates",
  "White Balance",
  "Image Setting"
];

/* =====================================
   COLLECT ONLY FILLED SPECIFICATIONS
===================================== */

function collectSpecifications() {
  const result = {};

  document.querySelectorAll("[data-spec-key]").forEach(field => {
    const key = field.dataset.specKey;
    const value = field.value.trim();

    if (key && value) {
      result[key] = value;
    }
  });

  return result;
}

/* =====================================
   LOAD OCR LIBRARIES
   Tesseract.js + PDF.js
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
      if (window[globalName]) {
        resolve(window[globalName]);
      } else {
        reject(new Error(`${globalName} library unavailable.`));
      }
    };

    script.onerror = () => {
      reject(new Error(`${globalName} library download failed.`));
    };

    document.head.appendChild(script);
  });
}

async function loadOCRLibraries() {
  if (ocrLibrariesPromise) {
    return ocrLibrariesPromise;
  }

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

    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }

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
   OCR TEXT NORMALIZATION
===================================== */

function normalizeOCRText(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[：]/g, ":")
    .replace(/[：؛]/g, ":")
    .replace(/[•●▪]/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeOCRKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f]/g, "");
}

/* =====================================
   OCR LABEL ALIASES
===================================== */

const OCR_FIELD_ALIASES = {
  "Image Sensor": [
    "image sensor",
    "sensor",
    "इमेज सेंसर",
    "सेंसर"
  ],
  "Minimum Illumination": [
    "minimum illumination",
    "min illumination",
    "minimum light",
    "न्यूनतम रोशनी"
  ],
  "Effective Pixels": [
    "effective pixels",
    "pixels",
    "resolution",
    "प्रभावी पिक्सेल"
  ],
  "Shutter Speed": [
    "shutter speed",
    "शटर स्पीड"
  ],
  "Angle Adjustment": [
    "angle adjustment",
    "पैन टिल्ट एडजस्टमेंट"
  ],
  "ROM": ["rom"],
  "White Balance": [
    "white balance",
    "wb",
    "व्हाइट बैलेंस"
  ],
  "Image Setting": [
    "image setting",
    "इमेज सेटिंग"
  ],
  "Lens Type": ["lens type", "लेंस टाइप"],
  "Max. Aperture": [
    "max aperture",
    "maximum aperture",
    "अधिकतम अपर्चर"
  ],
  "Lens Mount": ["lens mount"],
  "Smart IR": ["smart ir"],
  "IR Number": ["ir number"],
  "IR": ["ir distance", "ir range", "infrared distance"],
  "Day/Night": ["day/night", "day night"],
  "Close Focus Distance": ["close focus distance"],
  "DORI Distance": ["dori distance", "dori"],
  "Gain Control (AGC)": [
    "gain control",
    "agc",
    "automatic gain control"
  ],
  "Lens": ["lens"],
  "Video Compression": [
    "video compression",
    "video coding",
    "वीडियो कंप्रेशन"
  ],
  "Back Light Compensation": [
    "back light compensation",
    "blc"
  ],
  "S/N Ratio": ["s/n ratio", "sn ratio", "signal to noise"],
  "Angle of view": [
    "angle of view",
    "field of view",
    "fov",
    "viewing angle"
  ],
  "Stream Capability": [
    "stream capability",
    "stream"
  ],
  "Frame Rate": [
    "frame rate",
    "fps",
    "frames per second"
  ],
  "Resolution": ["resolution"],
  "Noise Reduction": [
    "noise reduction",
    "3d dnr",
    "dnr"
  ],
  "Defog": ["defog"],
  "Privacy Mask": ["privacy mask"],
  "Audio": ["audio"],
  "Audio Compression": ["audio compression"],
  "OSD": ["osd"],
  "Bit Rate Control": ["bit rate control"],
  "Bit Rate": ["bit rate"],
  "Protocol": ["protocol", "network protocol"],
  "Video Format": ["video format"],
  "SDK and API": ["sdk", "api", "sdk and api"],
  "Event Alarm": ["event alarm", "alarm event"],
  "Cyber Security": ["cyber security", "security"],
  "Device Search Tool": ["device search tool"],
  "OTA (Over-The-Air)": ["ota", "over the air"],
  "Audio Sampling Rate": ["audio sampling rate"],
  "Image Flip": ["image flip"],
  "Iris Control": ["iris control"],
  "Browser": ["browser"],
  "User/Host": ["user/host", "user host"],
  "Ethernet": ["ethernet"],
  "Storage": ["storage"],
  "Power Source": ["power source", "power supply"],
  "Power Consumption": ["power consumption"],
  "Operating Temperature": ["operating temperature"],
  "Operating Humidity": ["operating humidity"],
  "Storage Temperature": ["storage temperature"],
  "Storage Humidity": ["storage humidity"],
  "Certificates": ["certificates", "certification"],
  "Casing": ["casing", "housing"],
  "Dimensions": ["dimensions", "dimension"],
  "Weight": ["weight"]
};

/* =====================================
   EXTRACT VALUE AFTER A LABEL
===================================== */

function extractValueAfterLabel(line, aliases) {
  const normalizedLine = normalizeOCRKey(line);

  for (const alias of aliases) {
    const normalizedAlias = normalizeOCRKey(alias);

    if (!normalizedAlias) continue;

    const position = normalizedLine.indexOf(normalizedAlias);

    if (position === -1) continue;

    // Original line mein label ki approximate position.
    const lowerLine = line.toLowerCase();
    const lowerAlias = alias.toLowerCase();
    const originalPosition = lowerLine.indexOf(lowerAlias);

    if (originalPosition >= 0) {
      let value = line.slice(originalPosition + alias.length);

      value = value
        .replace(/^[\s:：|=\-–—]+/, "")
        .replace(/^[.·]+/, "")
        .trim();

      if (value) return value;
    }

    // OCR ne label aur value ko bina space joda ho to
    // normalized position se bhi attempt karein.
    const compactPosition = position + normalizedAlias.length;
    const compactLine = normalizeOCRKey(line);
    const compactValue = compactLine.slice(compactPosition);

    if (compactValue.length > 1) {
      return compactValue;
    }
  }

  return "";
}

/* =====================================
   FIND FIELD VALUE FROM OCR TEXT
===================================== */

function findOCRFieldValue(lines, aliases) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) continue;

    const value = extractValueAfterLabel(line, aliases);

    if (value) {
      return value.replace(/^[\s:|=-]+/, "").trim();
    }

    const normalizedLine = normalizeOCRKey(line);

    for (const alias of aliases) {
      const normalizedAlias = normalizeOCRKey(alias);

      if (
        normalizedAlias &&
        normalizedLine === normalizedAlias &&
        lines[i + 1]
      ) {
        const nextValue = lines[i + 1].trim();

        if (nextValue) return nextValue;
      }
    }
  }

  return "";
}

/* =====================================
   OCR CATEGORY DETECTION
===================================== */

function detectOCRCategory(text) {
  const value = text.toLowerCase();

  if (/\b(dvr)\b/.test(value)) return "DVR";
  if (/\b(nvr)\b/.test(value)) return "NVR";
  if (/video door phone|video doorbell/.test(value)) {
    return "Video Door Phones";
  }
  if (/\bip camera\b/.test(value)) return "IP Cameras";
  if (/cctv camera|bullet camera|dome camera|turret camera/.test(value)) {
    return "CCTV Cameras";
  }

  return "";
}

/* =====================================
   PARSE PRODUCT DETAILS FROM OCR
===================================== */

function parseOCRProductDetails(rawText) {
  const text = normalizeOCRText(rawText);
  const lines = text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const result = {
    name: "",
    category: "",
    model: "",
    price: "",
    description: "",
    features: [],
    specifications: {}
  };

  const productNameAliases = [
    "product name",
    "product",
    "camera name",
    "model name",
    "प्रोडक्ट का नाम",
    "उत्पाद का नाम"
  ];

  const modelAliases = [
    "model number",
    "model no",
    "model",
    "model no.",
    "मॉडल नंबर",
    "मॉडल"
  ];

  const priceAliases = [
    "selling price",
    "product price",
    "mrp",
    "price",
    "कीमत",
    "मूल्य"
  ];

  result.name = findOCRFieldValue(lines, productNameAliases);
  result.model = findOCRFieldValue(lines, modelAliases);

  const rawPrice = findOCRFieldValue(lines, priceAliases);
  const priceMatch = rawPrice.match(/[\d,]+(?:\.\d+)?/);

  if (priceMatch) {
    result.price = priceMatch[0].replace(/,/g, "");
  }

  result.category = detectOCRCategory(text);

  const descriptionAliases = [
    "description",
    "product description",
    "विवरण",
    "उत्पाद विवरण"
  ];

  result.description = findOCRFieldValue(
    lines,
    descriptionAliases
  );

  for (const key of SPECIFICATION_FIELDS) {
    const aliases = OCR_FIELD_ALIASES[key] || [key];

    const value = findOCRFieldValue(lines, aliases);

    if (value) {
      result.specifications[key] = value;
    }
  }

  // Product name ke liye document ke shuru ke meaningful
  // lines ko fallback ke roop mein use karein.
  if (!result.name) {
    const ignored = [
      "specification",
      "technical specification",
      "product details",
      "features",
      "description",
      "www.",
      "http"
    ];

    const candidate = lines.find(line => {
      const lower = line.toLowerCase();

      return (
        line.length >= 4 &&
        line.length <= 100 &&
        !ignored.some(item => lower.includes(item)) &&
        !/^\d+$/.test(line) &&
        !/^[A-Z0-9._-]+$/.test(line)
      );
    });

    if (candidate) {
      result.name = candidate;
    }
  }

  // Features section.
  const featureStart = lines.findIndex(line =>
    /^(features|key features|main features|मुख्य विशेषताएं)/i.test(line)
  );

  if (featureStart >= 0) {
    for (
      let i = featureStart + 1;
      i < lines.length && result.features.length < 15;
      i++
    ) {
      const line = lines[i];

      if (/^(specifications|technical specifications|description)/i.test(line)) {
        break;
      }

      if (line.length > 2 && line.length < 250) {
        result.features.push(
          line.replace(/^[-*•\d.)\s]+/, "").trim()
        );
      }
    }
  }

  return result;
}

/* =====================================
   FILL FORM USING OCR RESULT
===================================== */

function fillProductFormFromOCR(parsed) {
  const setValueIfFound = (id, value) => {
    const field = $(id);

    if (field && value !== undefined && value !== null) {
      const cleanValue = String(value).trim();

      if (cleanValue) {
        field.value = cleanValue;
      }
    }
  };

  setValueIfFound("productName", parsed.name);
  setValueIfFound("productModel", parsed.model);
  setValueIfFound("productPrice", parsed.price);
  setValueIfFound("productDescription", parsed.description);

  if (parsed.category) {
    const categorySelect = $("productCategory");

    if (categorySelect) {
      const matchingOption = Array.from(categorySelect.options).find(
        option =>
          option.value.toLowerCase() === parsed.category.toLowerCase()
      );

      if (matchingOption) {
        categorySelect.value = matchingOption.value;
      }
    }
  }

  if (parsed.features?.length) {
    const featuresField = $("productFeatures");

    if (featuresField) {
      const existingFeatures = featuresField.value
        .split("\n")
        .map(item => item.trim())
        .filter(Boolean);

      const merged = [
        ...new Set([...existingFeatures, ...parsed.features])
      ];

      featuresField.value = merged.join("\n");
    }
  }

  const specificationFields =
    document.querySelectorAll("[data-spec-key]");

  specificationFields.forEach(field => {
    const key = field.dataset.specKey;
    const value = parsed.specifications?.[key];

    // OCR mein value mili tabhi field fill karein.
    // Missing value ko blank hi chhodein.
    if (value && String(value).trim()) {
      field.value = String(value).trim();
    }
  });
}

/* =====================================
   TESSERACT IMAGE OCR
===================================== */

async function recognizeImageText(file, onProgress) {
  const { tesseract } = await loadOCRLibraries();

  onProgress?.("Hindi + English OCR engine load ho raha hai...");

  const result = await tesseract.recognize(
    file,
    "eng+hin",
    {
      logger: message => {
        if (message.status === "recognizing text") {
          const percent = Math.round(
            (message.progress || 0) * 100
          );

          onProgress?.(`Photo scan ho rahi hai: ${percent}%`);
        }
      }
    }
  );

  return result.data?.text || "";
}

/* =====================================
   PDF TEXT EXTRACTION
===================================== */

async function extractPDFText(file, onProgress) {
  const { pdfjs } = await loadOCRLibraries();

  const buffer = await file.arrayBuffer();

  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(buffer)
  }).promise;

  let fullText = "";

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    onProgress?.(
      `PDF page ${pageNumber}/${pdf.numPages} read ho raha hai...`
    );

    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    let lastY = null;
    const pageLines = [];

    for (const item of content.items) {
      if (!item.str) continue;

      const y = item.transform?.[5];

      if (
        lastY !== null &&
        typeof y === "number" &&
        Math.abs(y - lastY) > 3
      ) {
        pageLines.push("\n");
      }

      pageLines.push(item.str + " ");
      lastY = y;
    }

    fullText += "\n" + pageLines.join("");
  }

  return {
    text: normalizeOCRText(fullText),
    pdf
  };
}

/* =====================================
   OCR SCANNED PDF PAGE
===================================== */

async function recognizePDFPage(page, onProgress, pageNumber) {
  const { tesseract } = await loadOCRLibraries();

  const viewport = page.getViewport({ scale: 1.6 });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({
    canvasContext: context,
    viewport
  }).promise;

  onProgress?.(`PDF page ${pageNumber} ka OCR scan ho raha hai...`);

  const result = await tesseract.recognize(
    canvas,
    "eng+hin",
    {
      logger: message => {
        if (message.status === "recognizing text") {
          const percent = Math.round(
            (message.progress || 0) * 100
          );

          onProgress?.(
            `PDF page ${pageNumber}: OCR ${percent}%`
          );
        }
      }
    }
  );

  canvas.width = 0;
  canvas.height = 0;

  return result.data?.text || "";
}

/* =====================================
   PDF OCR HANDLER
===================================== */

async function recognizePDF(file, onProgress) {
  const { pdfjs } = await loadOCRLibraries();

  const buffer = await file.arrayBuffer();

  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(buffer)
  }).promise;

  let fullText = "";

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const pageText = content.items
      .map(item => item.str || "")
      .join(" ")
      .trim();

    if (pageText.length > 30) {
      fullText += "\n" + pageText;
    } else {
      const scannedText = await recognizePDFPage(
        page,
        onProgress,
        pageNumber
      );

      fullText += "\n" + scannedText;
    }
  }

  return normalizeOCRText(fullText);
}

/* =====================================
   OCR FILE VALIDATION
===================================== */

const MAX_OCR_FILE_BYTES = 15 * 1024 * 1024;

const ALLOWED_OCR_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

function validateOCRFile(file) {
  if (!file) {
    throw new Error("PDF ya photo select kijiye.");
  }

  const isPDF =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");

  const isImage = ALLOWED_OCR_IMAGE_TYPES.includes(file.type);

  if (!isPDF && !isImage) {
    throw new Error(
      "OCR ke liye PDF, JPG, PNG ya WEBP file select kijiye."
    );
  }

  if (file.size > MAX_OCR_FILE_BYTES) {
    throw new Error(
      "OCR file 15 MB se chhoti honi chahiye."
    );
  }

  return isPDF ? "pdf" : "image";
}

/* =====================================
   RUN OCR
===================================== */

async function scanProductDocument() {
  const input = $("productOCRFile");
  const button = $("scanOCRBtn");
  const status = $("ocrStatus");
  const resultBox = $("ocrExtractedText");

  const file = input?.files?.[0];

  if (!file) {
    if (status) {
      status.textContent = "Pehle PDF ya photo select kijiye.";
    }
    return;
  }

  let originalButtonText = "Scan & Auto Fill";

  try {
    const fileType = validateOCRFile(file);

    if (button) {
      originalButtonText = button.textContent;
      button.disabled = true;
      button.textContent = "Scanning...";
    }

    if (status) {
      status.textContent =
        "OCR start ho raha hai. File size aur pages ke hisaab se samay lag sakta hai.";
    }

    let extractedText = "";

    const progress = message => {
      if (status) status.textContent = message;
    };

    if (fileType === "pdf") {
      extractedText = await recognizePDF(file, progress);
    } else {
      extractedText = await recognizeImageText(file, progress);
    }

    if (!extractedText.trim()) {
      throw new Error(
        "Document se text read nahi hua. Clear photo ya PDF try kijiye."
      );
    }

    const parsed = parseOCRProductDetails(extractedText);

    fillProductFormFromOCR(parsed);

    if (resultBox) {
      resultBox.value = extractedText;
      resultBox.style.display = "block";
    }

    const filledSpecs = Object.keys(
      parsed.specifications || {}
    ).length;

    const filledFields = [
      parsed.name,
      parsed.model,
      parsed.price,
      parsed.category,
      parsed.description
    ].filter(Boolean).length;

    if (status) {
      status.textContent =
        `OCR complete! ${filledFields} product fields aur ${filledSpecs} specifications identify hui hain. Save karne se pehle details check kar lijiye.`;
    }

  } catch (error) {
    console.error("OCR error:", error);

    if (status) {
      status.textContent =
        error.message || "OCR scan failed.";
    }

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalButtonText;
    }
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
      ? product.specifications
      : {};

  const allSpecificationFields = [
    ...SPECIFICATION_FIELDS,
    ...Object.keys(specifications).filter(
      key => !SPECIFICATION_FIELDS.includes(key)
    )
  ];

  const specificationInputs = allSpecificationFields.map(key => {
    const value = specifications[key] ?? "";
    const fieldLabel = escapeHTML(key);
    const fieldValue = escapeHTML(value);

    if (LONG_SPECIFICATION_FIELDS.includes(key)) {
      return `
        <div class="specification-input">
          <label>${fieldLabel}</label>
          <textarea
            data-spec-key="${fieldLabel}"
            rows="3"
            placeholder="Enter ${fieldLabel}"
          >${fieldValue}</textarea>
        </div>
      `;
    }

    return `
      <div class="specification-input">
        <label>${fieldLabel}</label>
        <input
          type="text"
          data-spec-key="${fieldLabel}"
          value="${fieldValue}"
          placeholder="Enter ${fieldLabel}"
        >
      </div>
    `;
  }).join("");

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
          <input id="productPrice" type="number"
            min="0" step="0.01"
            value="${escapeHTML(product.price ?? "")}">
        </div>

      </div>

      <hr>

      <h3>Product Photo</h3>

      <div>
        <label for="productImageFile">
          Product Photo (Mobile / Computer se upload karein)
        </label>

        <input id="productImageFile" type="file"
          accept="image/jpeg,image/png,image/webp">

        <small class="muted">
          JPG, PNG ya WEBP. Maximum file size 5 MB.
        </small>

        <div style="margin:12px 0;">
          <img id="productImagePreview"
            src="${escapeHTML(product.imageUrl || "")}"
            alt="Product photo preview"
            style="display:${product.imageUrl ? "block" : "none"};max-width:180px;max-height:150px;object-fit:contain;border:1px solid #e2e8f0;border-radius:8px;padding:5px;">
        </div>

        <label for="productImage">Existing Image URL (optional)</label>

        <input id="productImage" type="url"
          value="${escapeHTML(product.imageUrl || "")}"
          placeholder="Optional: paste an existing image URL">

        <small class="muted">
          Nayi photo select karenge to Cloudinary par upload hogi.
        </small>

        <p id="imageUploadStatus" class="muted"
          aria-live="polite"></p>
      </div>

      <hr>

      <h3>Hindi + English OCR Document Scanner</h3>

      <p class="muted">
        Product ki specification PDF ya photo upload karke
        details automatically form mein fill karein.
      </p>

      <div class="product" style="margin:12px 0;">

        <label for="productOCRFile">
          OCR PDF / Photo Upload
        </label>

        <input
          id="productOCRFile"
          type="file"
          accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
        >

        <small class="muted">
          PDF, JPG, PNG, WEBP. Maximum file size 15 MB.
          English aur Hindi dono supported hain.
        </small>

        <button
          class="secondary"
          type="button"
          id="scanOCRBtn"
          style="margin-top:12px;">
          Scan & Auto Fill
        </button>

        <p id="ocrStatus" class="muted"
          aria-live="polite"></p>

        <label for="ocrExtractedText">
          Extracted OCR Text (Review)
        </label>

        <textarea
          id="ocrExtractedText"
          rows="8"
          readonly
          style="display:none;width:100%;"
          placeholder="OCR se nikla text yahan dikhega."
        ></textarea>

        <p class="muted">
          OCR ke baad product details check aur edit kijiye.
          Original OCR document permanent upload nahi hota.
        </p>

      </div>

      <hr>

      <h3>Description</h3>

      <div>
        <label>Description</label>
        <textarea id="productDescription">${escapeHTML(product.description || "")}</textarea>
      </div>

      <div>
        <label>Features (one per line)</label>
        <textarea id="productFeatures">${escapeHTML(features)}</textarea>
      </div>

      <hr>

      <h3>Technical Specifications</h3>

      <p class="muted">
        Har specification ki value alag field mein enter karein.
        Jo specification available nahi hai use blank chhod sakte hain.
      </p>

      <div class="grid specification-grid">
        ${specificationInputs}
      </div>

      <hr>

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

      <button class="primary" id="saveProductBtn"
        data-original-label="${product.id ? "Update Product" : "Save Product"}"
        type="submit">
        ${product.id ? "Update Product" : "Save Product"}
      </button>

      <button class="secondary" type="button" id="cancelProduct">
        Cancel
      </button>

    </form>
  `;
}

/* =====================================
   CLOUDINARY IMAGE UPLOAD
===================================== */

const CLOUDINARY_CLOUD_NAME = "ch5mab4a";
const CLOUDINARY_UPLOAD_PRESET = "rbtech_products";
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_PRODUCT_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

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
  formData.append("folder", "rb-tech-solution/products");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.secure_url) {
    console.error("Cloudinary upload error:", result);

    throw new Error(
      result.error?.message ||
      "Photo upload nahi hui. Cloudinary Upload Preset ka Unsigned mode check kijiye."
    );
  }

  if (status) {
    status.textContent = "Photo upload successful.";
  }

  return result.secure_url;
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
  const imageFileInput = $("productImageFile");

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

    const price = priceValue === "" ? null : Number(priceValue);

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

    let imageUrl = $("productImage").value.trim();

    if (imageFileInput?.files?.[0]) {
      showMessage(
        dashboardMessage,
        "Product photo upload ho rahi hai..."
      );

      imageUrl = await uploadProductImage(
        imageFileInput.files[0]
      );

      $("productImage").value = imageUrl;

    } else if (!imageUrl && existing?.imageUrl) {
      imageUrl = existing.imageUrl;
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
      imageUrl,
      description: $("productDescription").value.trim(),
      features,
      specifications: collectSpecifications(),
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
      "Product and photo successfully saved.",
      true
    );

    showProducts();

  } catch (error) {
    console.error("Product save error:", error);

    showMessage(
      dashboardMessage,
      error.message || "Product save nahi hua."
    );

    const status = $("imageUploadStatus");

    if (status) {
      status.textContent = error.message || "Upload/save failed.";
    }

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
   VIEW COMPLETE PRODUCT DETAILS
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

  // Internal fields jo customer ko nahi dikhane hain
  const hiddenFields = [
    "id",
    "customerId",
    "customerUid",
    "uid",
    "createdAt",
    "updatedAt",
    "timestamp",
    "imageUrl",
    "features",
    "specifications"
  ];

  // Field name ko readable label mein badlein
  function makeLabel(key) {
    return String(key)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  // Kisi bhi saved value ko readable banayein
  function formatValue(value) {
    if (value === null || value === undefined) return "";

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    if (Array.isArray(value)) {
      return value
        .map(item => typeof item === "object"
          ? JSON.stringify(item)
          : String(item)
        )
        .filter(Boolean)
        .join(", ");
    }

    if (typeof value === "object") {
      return Object.entries(value)
        .map(([key, val]) => `${makeLabel(key)}: ${String(val)}`)
        .join(" | ");
    }

    return String(value).trim();
  }

  // Product ke saare filled normal fields
  const generalRows = Object.entries(product)
    .filter(([key, value]) => {
      if (hiddenFields.includes(key)) return false;
      if (value === null || value === undefined) return false;
      if (typeof value === "string" && !value.trim()) return false;
      if (typeof value === "object" &&
          !Array.isArray(value) &&
          Object.keys(value).length === 0) return false;

      return true;
    })
    .map(([key, value]) => `
      <tr>
        <th>${escapeHTML(makeLabel(key))}</th>
        <td>${escapeHTML(formatValue(value))}</td>
      </tr>
    `)
    .join("");

  // Features
  const features = Array.isArray(product.features)
    ? product.features
    : String(product.features || "")
        .split("\n");

  const featuresHTML = features
    .map(item => String(item).trim())
    .filter(Boolean)
    .map(item => `<li>${escapeHTML(item)}</li>`)
    .join("");

  // Saari filled specifications
  const specifications =
    product.specifications &&
    typeof product.specifications === "object"
      ? product.specifications
      : {};

  const specificationRows = Object.entries(specifications)
    .filter(([key, value]) =>
      key &&
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
    )
    .map(([key, value]) => `
      <tr>
        <th>${escapeHTML(makeLabel(key))}</th>
        <td>${escapeHTML(formatValue(value))}</td>
      </tr>
    `)
    .join("");

  const modal = document.createElement("div");
  modal.id = "productDetailsModal";

  modal.innerHTML = `
    <div class="product-details-overlay">
      <div class="product-details-box">

        <button
          class="product-details-close"
          type="button"
          data-close-details
        >&times;</button>

        <h2>Complete Product Details</h2>

        ${
          product.imageUrl
            ? `
              <div class="product-details-image">
                <img
                  src="${escapeHTML(product.imageUrl)}"
                  alt="${escapeHTML(product.name || "Product")}"
                >
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
            : ""
        }

        <button
          type="button"
          class="product-details-bottom-close"
          data-close-details
        >Close</button>

      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close buttons
  modal.querySelectorAll("[data-close-details]")
    .forEach(button => {
      button.addEventListener("click", closeProductDetails);
    });

  // Overlay par click karne se close
  modal.addEventListener("click", event => {
    if (
      event.target.classList.contains(
        "product-details-overlay"
      )
    ) {
      closeProductDetails();
    }
  });

  // Escape key se close
  document.addEventListener("keydown", function escapeHandler(event) {
    if (event.key === "Escape") {
      closeProductDetails();
      document.removeEventListener("keydown", escapeHandler);
    }
  });
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

      <button
        type="button"
        class="secondary"
        data-view="${escapeHTML(product.id)}"
      >
        View Details
      </button>

      <button
        type="button"
        class="primary"
        data-edit="${escapeHTML(product.id)}"
      >
        Edit
      </button>

      <button
        type="button"
        class="danger"
        data-delete="${escapeHTML(product.id)}"
      >
        Delete
      </button>

    </article>

  `).join("");

  sectionContent.innerHTML = `

    <h2>My Products</h2>

    <p class="muted">
      Add and manage your business products.
    </p>

    <button
      type="button"
      class="primary"
      id="addProductBtn"
    >
      + Add Product
    </button>

    <div id="productFormArea"></div>

    <div class="product-list">
      ${
        productCards ||
        "<p>No products added yet.</p>"
      }
    </div>

  `;

  // ADD PRODUCT
  $("addProductBtn")?.addEventListener("click", () => {

    editingProductId = null;

    $("productFormArea").innerHTML = productFormHTML();

    attachProductFormEvents();

    $("productFormArea").scrollIntoView({
      behavior: "smooth"
    });

  });

  // VIEW DETAILS
  sectionContent.querySelectorAll("[data-view]").forEach(button => {

    button.addEventListener("click", () => {

      viewProductDetails(button.dataset.view);

    });

  });

  // EDIT PRODUCT
  sectionContent.querySelectorAll("[data-edit]").forEach(button => {

    button.addEventListener("click", () => {

      const product = currentProducts.find(
        item => item.id === button.dataset.edit
      );

      if (!product) return;

      editingProductId = product.id;

      $("productFormArea").innerHTML =
        productFormHTML(product);

      attachProductFormEvents();

      $("productFormArea").scrollIntoView({
        behavior: "smooth"
      });

    });

  });

  // DELETE PRODUCT
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

      preview.dataset.objectUrl = URL.createObjectURL(file);
      preview.src = preview.dataset.objectUrl;
      preview.style.display = "block";
    }

    if (status) {
      status.textContent =
        "Photo ready hai. Save Product dabakar upload karein.";
    }
  });

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
  const enquiryCards = currentEnquiries.map(enquiry => `
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
  `).join("");

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

  sectionContent
    .querySelectorAll("[data-enquiry-read]")
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
        <p><b>Plan:</b> ${escapeHTML(currentCustomer.plan || "-")}</p>
        <p><b>Amount:</b> ₹${escapeHTML(amountText)}</p>
        <p><b>Status:</b> ${escapeHTML(statusText)}</p>
        <p><b>Expiry Date:</b> ${escapeHTML(expiryText)}</p>
      </div>

      <div class="product">
        <h3>Renew Subscription</h3>

        <p>
          Apne subscription ko renew karne ke liye neeche diye gaye UPI ID par payment kijiye.
        </p>

        <p><b>UPI ID:</b></p>

        <input
          id="renewalUPI"
          value="${RENEWAL_UPI_ID}"
          readonly
        >

        <button
          class="secondary"
          type="button"
          id="copyRenewalUPI">
          Copy UPI ID
        </button>

        <p><b>Payment Amount:</b> ₹${escapeHTML(amountText)}</p>

        <p class="muted">
          Payment karne ke baad UTR / Transaction Reference Number submit kijiye.
          Admin payment verify karne ke baad request approve karega.
        </p>

        <form id="renewalForm">
          <label for="renewalUTR">
            UTR / Transaction Reference Number *
          </label>

          <input
            id="renewalUTR"
            type="text"
            minlength="6"
            maxlength="50"
            required
            placeholder="Enter payment UTR number"
          >

          <button
            class="primary"
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

    try {
      const requests = await loadSubscriptionRequests();
      const history = $("renewalHistory");

      if (history) {
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
                  <p><b>Amount:</b> ₹${escapeHTML(request.amount ?? "-")}</p>
                  <p><b>UTR:</b> ${escapeHTML(request.utr || "-")}</p>
                  <p><b>Date:</b> ${escapeHTML(date)}</p>
                  <p><b>Status:</b> ${escapeHTML(status)}</p>
                </article>
              `;
            }).join("")
          : "<p>No renewal requests submitted yet.</p>";
      }

    } catch (error) {
      console.error("Renewal history error:", error);

      const history = $("renewalHistory");

      if (history) {
        history.textContent =
          "Renewal history load nahi hui: " + error.message;
      }
    }

    return;
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
      authInitialized = true;

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
