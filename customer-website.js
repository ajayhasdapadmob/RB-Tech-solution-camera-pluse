
import { auth, db } from "./firebase.js";

import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

/* =========================================
   CUSTOMER WEBSITE CONFIGURATION
========================================= */

const CUSTOMER_WEBSITES = {

  rbtechsolution: {
    businessName: "RB Tech Solution",
    tagline: "CCTV & Security Systems",
    logo: "https://ajayhasdapadmob.github.io/RB-Tech-solution-camera-pluse/images/logo.png",
    phone: "919663116089",
    email: "",
    address: "",
    whatsappMessage: "Hello RB Tech Solution, I need more information.",
    privacyUrl: "privacy-policy.html"
  },

  intelloelectric: {
    businessName: "Intello Electric",
    tagline: "Electrical Products & Solutions",
    logo: "https://ajayhasdapadmob.github.io/RB-Tech-solution-camera-pluse/images/intello-logo.png",
    phone: "919448735433",
    email: "",
    address: "",
    whatsappMessage: "Hello Intello Electric, I need more information.",
    privacyUrl: "privacy-policy.html"
  }

};

/* =========================================
   WEBSITE IDENTIFICATION
========================================= */

function getHostname() {
  return window.location.hostname
    .toLowerCase()
    .replace(/^www\./, "");
}

function getCustomerId() {

  const params = new URLSearchParams(window.location.search);

  const previewCustomer = params.get("customer");

  if (previewCustomer) {
    return previewCustomer.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  }

  const hostname = getHostname();

  const domainMap = {
    "rb-tech-solution-camera-pluse-pages.pages.dev": "rbtechsolution",
    "ajayhasdapadmob.github.io": "rbtechsolution",
    "intelloelectric.com": "intelloelectric",
    "www.intelloelectric.com": "intelloelectric"
  };

  if (domainMap[hostname]) {
    return domainMap[hostname];
  }

  const parts = hostname.split(".");

  if (parts.length >= 3) {
    const subdomain = parts[0];

    if (CUSTOMER_WEBSITES[subdomain]) {
      return subdomain;
    }
  }

  return "rbtechsolution";
}

const customerId = getCustomerId();

const websiteBrand =
  CUSTOMER_WEBSITES[customerId] ||
  CUSTOMER_WEBSITES.rbtechsolution;

/* =========================================
   HELPER FUNCTIONS
========================================= */

function getElement(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = getElement(id);

  if (element && value !== undefined && value !== null) {
    element.textContent = value;
  }
}

function formatPhone(phone) {

  const digits = String(phone || "").replace(/\D/g, "");

  if (digits.length === 10) {
    return "+91 " + digits.slice(0, 5) + " " + digits.slice(5);
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return "+91 " + digits.slice(2, 7) + " " + digits.slice(7);
  }

  return phone || "";
}

function getWhatsAppNumber(phone) {

  let digits = String(phone || "").replace(/\D/g, "");

  if (digits.length === 10) {
    digits = "91" + digits;
  }

  return digits;
}

function showStatus(message, type = "success") {

  const status = getElement("enquiryStatus");

  if (!status) {
    alert(message);
    return;
  }

  status.textContent = message;
  status.className = "enquiry-status " + type;
  status.style.display = "block";
}

/* =========================================
   APPLY CUSTOMER BRANDING
========================================= */

function applyCustomerBranding() {

  document.title =
    websiteBrand.businessName +
    " | " +
    websiteBrand.tagline;

  setText("businessName", websiteBrand.businessName);
  setText("brandName", websiteBrand.businessName);
  setText("businessTagline", websiteBrand.tagline);
  setText("footerBusinessName", websiteBrand.businessName);

  setText("contactPhone", formatPhone(websiteBrand.phone));

  const logo = getElement("businessLogo");

  if (logo && websiteBrand.logo) {
    logo.src = websiteBrand.logo;
    logo.alt = websiteBrand.businessName + " Logo";

    logo.onerror = () => {
      logo.style.display = "none";
    };
  }

  const phoneLink = getElement("phoneLink");

  if (phoneLink) {
    phoneLink.href = "tel:+" + getWhatsAppNumber(websiteBrand.phone);
  }

  const whatsappLink = getElement("whatsappLink");

  if (whatsappLink) {

    const number = getWhatsAppNumber(websiteBrand.phone);

    whatsappLink.href =
      "https://wa.me/" +
      number +
      "?text=" +
      encodeURIComponent(websiteBrand.whatsappMessage);
  }

  const privacyLink = getElement("privacyPolicyLink");

  if (privacyLink) {
    privacyLink.href = websiteBrand.privacyUrl;
  }

  document.querySelectorAll("[data-business-name]").forEach(element => {
    element.textContent = websiteBrand.businessName;
  });

  document.querySelectorAll("[data-business-phone]").forEach(element => {
    element.textContent = formatPhone(websiteBrand.phone);
  });

  document.querySelectorAll("[data-business-tagline]").forEach(element => {
    element.textContent = websiteBrand.tagline;
  });
}

/* =========================================
   PRODUCT ENQUIRY DATA
========================================= */

let selectedProduct = null;

function getInquiryProductId() {

  if (selectedProduct?.id) {
    return selectedProduct.id;
  }

  const productId = getElement("enquiryProductId");

  return productId?.value || "";
}

function getInquiryProductName() {

  if (selectedProduct?.name) {
    return selectedProduct.name;
  }

  const productName = getElement("enquiryProductName");

  return productName?.value || "General Enquiry";
}

/* =========================================
   OPEN ENQUIRY FORM
========================================= */

window.openProductEnquiry = function(product) {

  selectedProduct = product || null;

  const modal = getElement("enquiryModal");

  if (!modal) return;

  const productName = getElement("enquiryProductName");
  const productId = getElement("enquiryProductId");

  if (productName) {
    productName.value = product?.name || "";
  }

  if (productId) {
    productId.value = product?.id || "";
  }

  modal.style.display = "flex";
};

window.closeProductEnquiry = function() {

  const modal = getElement("enquiryModal");

  if (modal) {
    modal.style.display = "none";
  }
};

/* =========================================
   FIRESTORE ENQUIRY SUBMISSION
========================================= */

async function submitEnquiry(event) {

  event.preventDefault();

  const submitButton = getElement("submitEnquiryBtn");

  const name = getElement("enquiryName")?.value.trim();
  const phone = getElement("enquiryPhone")?.value.trim();
  const email = getElement("enquiryEmail")?.value.trim();
  const message = getElement("enquiryMessage")?.value.trim();
  const country = getElement("enquiryCountry")?.value || "India";

  if (!name || !phone) {
    showStatus("Please enter your name and phone number.", "error");
    return;
  }

  if (!/^[0-9+\-\s()]{7,20}$/.test(phone)) {
    showStatus("Please enter a valid phone number.", "error");
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";
  }

  try {

    const enquiryData = {

      customerId: customerId,

      businessName: websiteBrand.businessName,

      name: name,

      phone: phone,

      email: email,

      country: country,

      productName: getInquiryProductName(),

      message: message,

      status: "New",

      createdAt: serverTimestamp()

    };

    const productId = getInquiryProductId();

    if (productId) {
      enquiryData.productId = productId;
    }

    await addDoc(
      collection(db, "enquiries"),
      enquiryData
    );

    showStatus(
      "Thank you! Your enquiry has been submitted successfully.",
      "success"
    );

    const form = getElement("enquiryForm");

    if (form) {
      form.reset();
    }

    selectedProduct = null;

    setTimeout(() => {
      window.closeProductEnquiry();
    }, 2500);

  } catch (error) {

    console.error("Enquiry submission error:", error);

    showStatus(
      "Unable to submit your enquiry. Please try again or contact us on WhatsApp.",
      "error"
    );

  } finally {

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Submit Enquiry";
    }

  }
}

/* =========================================
   INITIALIZE WEBSITE
========================================= */

function initializeCustomerWebsite() {

  applyCustomerBranding();

  const enquiryForm = getElement("enquiryForm");

  if (enquiryForm) {
    enquiryForm.addEventListener("submit", submitEnquiry);
  }

  const modal = getElement("enquiryModal");

  if (modal) {

    modal.addEventListener("click", event => {

      if (event.target === modal) {
        window.closeProductEnquiry();
      }

    });

  }

  console.log(
    "Customer website initialized:",
    customerId,
    websiteBrand.businessName
  );

}

/* =========================================
   AUTH STATE
========================================= */

onAuthStateChanged(auth, user => {

  console.log(
    "Customer website auth:",
    user ? "Logged in" : "Guest"
  );

});

document.addEventListener(
  "DOMContentLoaded",
  initializeCustomerWebsite
);
