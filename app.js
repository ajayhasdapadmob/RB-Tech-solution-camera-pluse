import { db } from "./firebase.js";

import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* =========================================
   RB TECH SOLUTION - WEBSITE APP
   Customer Products + Old Products
   No Firebase Storage required
========================================= */

const WHATSAPP_NUMBER = "919663116089";

const DEFAULT_IMAGE =
  "https://ajayhasdapadmob.github.io/RB-Tech-solution-camera-pluse/images/products/jaise%20camera-01.jpg.png";

const CATEGORY_NAMES = [
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

let allProducts = [];
let heroSlideTimer = null;

const productGrid = document.getElementById("productGrid");
const trendingGrid = document.getElementById("trendingGrid");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");

const productModal = document.getElementById("productModal");
const modalClose = document.getElementById("modalClose");
const modalContent = document.getElementById("modalContent");

const enquiryName = document.getElementById("enquiryName");
const enquiryProduct = document.getElementById("enquiryProduct");
const enquiryMessage = document.getElementById("enquiryMessage");
const enquiryWhatsApp = document.getElementById("enquiryWhatsApp");

/* =========================================
   HELPER FUNCTIONS
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

function getProductImage(product) {
  return product.imageUrl ||
    product.image ||
    product.photo ||
    DEFAULT_IMAGE;
}

function getProductName(product) {
  return product.name ||
    product.productName ||
    product.title ||
    "Security Product";
}

function getProductCategory(product) {
  return product.category ||
    product.productCategory ||
    "Accessories";
}

function getProductModel(product) {
  return String(
    product.model ||
    product.modelNumber ||
    product.sku ||
    ""
  ).trim();
}

function getProductPrice(product) {
  if (
    product.price === undefined ||
    product.price === null ||
    String(product.price).trim() === ""
  ) {
    return "";
  }

  return "₹" + product.price;
}

function openWhatsApp(message) {
  const url =
    "https://wa.me/" +
    WHATSAPP_NUMBER +
    "?text=" +
    encodeURIComponent(message);

  window.open(url, "_blank", "noopener");
}

/* =========================================
   PRODUCT CARD
========================================= */

function createProductCard(product, index) {
  const card = document.createElement("article");
  card.className = "product-card";

  const name = getProductName(product);
  const category = getProductCategory(product);
  const image = getProductImage(product);
  const model = getProductModel(product);
  const price = getProductPrice(product);

  card.innerHTML = `
    <div
      class="product-image"
      role="button"
      tabindex="0"
      data-product-index="${index}"
      aria-label="View ${escapeHTML(name)} details"
    >
      <img
        src="${escapeHTML(image)}"
        alt="${escapeHTML(name)}"
        loading="lazy"
        onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}'"
      >
    </div>

    <div class="product-info">
      <span class="product-category">
        ${escapeHTML(category)}
      </span>

      <h3>${escapeHTML(name)}</h3>

      ${model ? `
        <p class="product-model">
          Model: ${escapeHTML(model)}
        </p>
      ` : ""}

      ${price ? `
        <p class="product-price">
          ${escapeHTML(price)}
        </p>
      ` : ""}

      <div class="product-actions">
        <button
          class="view-details-btn"
          type="button"
          data-product-index="${index}"
        >
          View Details
        </button>

        <button
          class="enquire-btn"
          type="button"
          data-enquire-index="${index}"
        >
          Enquire
        </button>
      </div>
    </div>
  `;

  return card;
}

/* =========================================
   DISPLAY PRODUCTS
========================================= */

function displayProducts(products = allProducts) {
  if (!productGrid) return;

  productGrid.innerHTML = "";

  if (!products.length) {
    productGrid.innerHTML =
      "<p class='no-products'>No products found.</p>";
    return;
  }

  products.forEach(product => {
    const index = allProducts.indexOf(product);
    productGrid.appendChild(createProductCard(product, index));
  });
}

/* =========================================
   TRENDING PRODUCTS
========================================= */

function displayTrendingProducts() {
  if (!trendingGrid) return;

  trendingGrid.innerHTML = "";

  const trending = allProducts.filter(product =>
    product.trending === true ||
    product.isTrending === true ||
    product.featured === true
  );

  const products = (
    trending.length > 0 ? trending : allProducts
  ).slice(0, 8);

  if (!products.length) {
    trendingGrid.innerHTML = "<p>No products available.</p>";
    return;
  }

  products.forEach(product => {
    const index = allProducts.indexOf(product);
    const card = createProductCard(product, index);

    const imageBox = card.querySelector(".product-image");

    if (imageBox) {
      const badge = document.createElement("span");
      badge.className = "new-product-badge";
      badge.textContent = "NEW";
      imageBox.appendChild(badge);
    }

    trendingGrid.appendChild(card);
  });
}

function setupTrendingCarousel() {
  if (!trendingGrid || trendingGrid.dataset.carouselReady === "true") {
    return;
  }

  trendingGrid.dataset.carouselReady = "true";

  const wrapper = document.createElement("div");
  wrapper.className = "trending-carousel-wrapper";

  trendingGrid.parentNode.insertBefore(wrapper, trendingGrid);
  wrapper.appendChild(trendingGrid);

  const controls = document.createElement("div");
  controls.className = "trending-carousel-controls";

  controls.innerHTML = `
    <button type="button" class="trending-prev" aria-label="Previous products">
      &#10094;
    </button>

    <button type="button" class="trending-next" aria-label="Next products">
      &#10095;
    </button>
  `;

  wrapper.appendChild(controls);

  controls.querySelector(".trending-prev").addEventListener("click", () => {
    trendingGrid.scrollBy({ left: -300, behavior: "smooth" });
  });

  controls.querySelector(".trending-next").addEventListener("click", () => {
    trendingGrid.scrollBy({ left: 300, behavior: "smooth" });
  });
}

/* =========================================
   CATEGORY NAVIGATION
========================================= */

function selectProductCategory(category) {
  if (categoryFilter) {
    categoryFilter.value = category || "";
    categoryFilter.dispatchEvent(new Event("change"));
  }

  document.getElementById("products")?.scrollIntoView({
    behavior: "smooth"
  });
}

function createOfferCategoryCards() {
  const offerContent = document.querySelector(".offer-content");
  if (!offerContent) return;

  let container = document.getElementById("offerCategoryGrid");

  if (!container) {
    container = document.createElement("div");
    container.id = "offerCategoryGrid";
    container.className = "offer-category-grid";
    offerContent.appendChild(container);
  }

  container.innerHTML = "";

  CATEGORY_NAMES.forEach(category => {
    const matching = allProducts.find(
      product =>
        getProductCategory(product).toLowerCase() ===
        category.toLowerCase()
    );

    const card = document.createElement("button");
    card.type = "button";
    card.className = "offer-category-card";

    card.innerHTML = `
      <img
        src="${escapeHTML(matching ? getProductImage(matching) : DEFAULT_IMAGE)}"
        alt="${escapeHTML(category)}"
        loading="lazy"
      >

      <h3>${escapeHTML(category)}</h3>
      <span>Explore Products →</span>
    `;

    card.addEventListener("click", () => {
      selectProductCategory(category);
    });

    container.appendChild(card);
  });

  const showAll = document.createElement("button");
  showAll.type = "button";
  showAll.className = "offer-show-all";
  showAll.textContent = "SHOW ALL PRODUCTS";

  showAll.addEventListener("click", () => {
    selectProductCategory("");
  });

  container.appendChild(showAll);
}

/* =========================================
   SEARCH AND FILTER
========================================= */

function filterProducts() {
  const search = (searchInput?.value || "").trim().toLowerCase();
  const category = categoryFilter?.value || "";

  const filtered = allProducts.filter(product => {
    const searchable = [
      getProductName(product),
      getProductCategory(product),
      getProductModel(product),
      product.description || ""
    ].join(" ").toLowerCase();

    const matchesSearch = searchable.includes(search);

    const matchesCategory =
      !category ||
      getProductCategory(product).toLowerCase() === category.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  displayProducts(filtered);
}

/* =========================================
   FEATURES HELPER
========================================= */

function getProductFeatures(product) {
  let features = product.features || [];

  if (typeof features === "string") {
    features = features.split("\n");
  }

  if (!Array.isArray(features)) {
    return [];
  }

  return features
    .map(feature => {
      if (typeof feature === "string") {
        return feature.trim();
      }

      if (feature && typeof feature === "object") {
        return String(
          feature.value || feature.name || feature.feature || ""
        ).trim();
      }

      return "";
    })
    .filter(Boolean);
}

/* =========================================
   SPECIFICATIONS HELPER
========================================= */

function getProductSpecifications(product) {
  const raw = product.specifications || {};
  let specifications = [];

  if (Array.isArray(raw)) {
    specifications = raw
      .map(item => {
        if (!item || typeof item !== "object") return null;

        const label = String(
          item.label || item.name || item.key || ""
        ).trim();

        const value = String(
          item.value ?? item.description ?? ""
        ).trim();

        return label && value ? { label, value } : null;
      })
      .filter(Boolean);

  } else if (raw && typeof raw === "object") {
    specifications = Object.entries(raw)
      .map(([key, value]) => {
        const label = String(key).trim();

        let text = "";

        if (value && typeof value === "object") {
          text = String(
            value.value || value.description || ""
          ).trim();
        } else {
          text = String(value ?? "").trim();
        }

        return label && text ? { label, value: text } : null;
      })
      .filter(Boolean);
  }

  return specifications;
}

/* =========================================
   REQUEST FOR INFORMATION - COUNTRY LIST
   Existing country options retained
========================================= */

const RFI_COUNTRIES = `
India|Australia|Bahrain|Bangladesh|Belgium|Bhutan|Cambodia|Canada|Chile|China|Congo|Cyprus|Czech Republic|Denmark|Doha-Qatar|Dubai|Hong Kong|Japan|Italy|United States|Afghanistan|Albania|Algeria|Andorra|Angola|Antigua and Barbuda|Argentina|Armenia|Austria|Azerbaijan|Bahamas|Barbados|Belarus|Belize|Benin|Bolivia|Bosnia and Herzegovina|Botswana|Brazil|Brunei|Bulgaria|Burkina Faso|Burundi|Côte d'Ivoire|Cabo Verde|Cameroon|Central African Republic|Chad|Colombia|Comoros|Congo (Congo-Brazzaville)|Costa Rica|Croatia|Cuba|Czechia (Czech Republic)|Democratic Republic of the Congo|Djibouti|Dominica|Dominican Republic|Ecuador|Egypt|El Salvador|Equatorial Guinea|Eritrea|Estonia|Eswatini (fmr. Swaziland)|Ethiopia|Fiji|Finland|France|Gabon|Gambia|Georgia|Germany|Ghana|Greece|Grenada|Guatemala|Guinea|Guinea-Bissau|Guyana|Haiti|Holy See|Honduras|Hungary|Iceland|Indonesia|Iran|Iraq|Ireland|Israel|Jamaica|Jordan|Kazakhstan|Kenya|Kiribati|Kuwait|Kyrgyzstan|Laos|Latvia|Lebanon|Lesotho|Liberia|Libya|Liechtenstein|Lithuania|Luxembourg|Madagascar|Malawi|Malaysia|Maldives|Mali|Malta|Marshall Islands|Mauritania|Mauritius|Mexico|Micronesia|Moldova|Monaco|Mongolia|Montenegro|Morocco|Mozambique|Myanmar (formerly Burma)|Namibia|Nauru|Nepal|Netherlands|New Zealand|Nicaragua|Niger|Nigeria|North Korea|North Macedonia|Norway|Oman|Pakistan|Palau|Palestine State|Panama|Papua New Guinea|Paraguay|Peru|Philippines|Poland|Portugal|Qatar|Romania|Russia|Rwanda|Saint Kitts and Nevis|Saint Lucia|Saint Vincent and the Grenadines|Samoa|San Marino|Sao Tome and Principe|Saudi Arabia|Senegal|Serbia|Seychelles|Sierra Leone|Singapore|Slovakia|Slovenia|Solomon Islands|Somalia|South Africa|South Korea|South Sudan|Spain|Sri Lanka|Sudan|Suriname|Sweden|Switzerland|Syria|Tajikistan|Tanzania|Thailand|Timor-Leste|Togo|Tonga|Trinidad and Tobago|Tunisia|Turkey|Turkmenistan|Tuvalu|Uganda|Ukraine|United Arab Emirates|United Kingdom|United States of America|Uruguay|Uzbekistan|Vanuatu|Venezuela|Vietnam|Yemen|Zambia|Zimbabwe
`.trim().split("|");

/* =========================================
   CUSTOMER PRODUCT ROUTING HELPERS
========================================= */

function getCustomerId(product) {
  return String(product?.customerId || "").trim();
}

function getCustomerProductId(product) {
  if (!product?.customerId) return "";
  return String(product.id || "").trim();
}

function findProductByName(productName) {
  const search = String(productName || "").trim().toLowerCase();

  if (!search) return null;

  return allProducts.find(product =>
    getProductName(product).trim().toLowerCase() === search
  ) || null;
}

/* =========================================
   CAPTCHA HELPERS
========================================= */

function createCaptchaQuestion() {
  const first = Math.floor(Math.random() * 9) + 1;
  const second = Math.floor(Math.random() * 9) + 1;

  return {
    question: `${first} + ${second} = ?`,
    answer: String(first + second)
  };
}

function refreshRFICaptcha(form) {
  if (!form) return;

  const questionElement = form.querySelector("#rfiCaptchaQuestion");
  const answerInput = form.querySelector("#rfiCaptcha");

  const captcha = createCaptchaQuestion();

  form.dataset.captchaAnswer = captcha.answer;

  if (questionElement) {
    questionElement.textContent = captcha.question;
  }

  if (answerInput) {
    answerInput.value = "";
  }
}

/* =========================================
   REQUEST FOR INFORMATION FORM
========================================= */

function createRFIForm(product) {
  const countryOptions = RFI_COUNTRIES.map(country => `
    <option value="${escapeHTML(country)}">
      ${escapeHTML(country)}
    </option>
  `).join("");

  const captcha = createCaptchaQuestion();

  return `
    <section class="rfi-section" id="RequestInformation">
      <h2>Request for Information</h2>

      <p class="rfi-required-note">
        Please fill in all required fields marked with *
      </p>

      <form id="rfiForm" data-captcha-answer="${captcha.answer}">

        <input type="hidden" name="productName"
          value="${escapeHTML(getProductName(product))}">

        <input type="hidden" name="productModel"
          value="${escapeHTML(getProductModel(product))}">

        <input type="hidden" name="customerId"
          value="${escapeHTML(getCustomerId(product))}">

        <input type="hidden" name="customerProductId"
          value="${escapeHTML(getCustomerProductId(product))}">

        <div class="rfi-form-group">
          <label for="rfiName">Name *</label>
          <input id="rfiName" name="name" type="text"
            maxlength="100" autocomplete="name" required
            placeholder="Enter your name">
        </div>

        <div class="rfi-form-group">
          <label for="rfiEmail">Email Address *</label>
          <input id="rfiEmail" name="email" type="email"
            maxlength="150" autocomplete="email" required
            placeholder="Enter your email address">
        </div>

        <div class="rfi-form-group">
          <label for="rfiCompany">Your Company *</label>
          <input id="rfiCompany" name="company" type="text"
            maxlength="150" autocomplete="organization" required
            placeholder="Enter your company name">
        </div>

        <div class="rfi-form-group">
          <label for="rfiCountry">Your Country *</label>
          <select id="rfiCountry" name="country" required>
            <option value="">Select country</option>
            ${countryOptions}
          </select>
        </div>

        <div class="rfi-form-group">
          <label for="rfiState">State *</label>
          <input id="rfiState" name="state" type="text"
            maxlength="100" required placeholder="Enter your state">
        </div>

        <div class="rfi-form-group">
          <label for="rfiCity">City *</label>
          <input id="rfiCity" name="city" type="text"
            maxlength="100" required placeholder="Enter your city">
        </div>

        <div class="rfi-form-group">
          <label for="rfiPhone">Contact number *</label>
          <input id="rfiPhone" name="phone" type="tel"
            maxlength="25" autocomplete="tel" required
            pattern="[0-9+()\\s-]{7,25}"
            placeholder="Enter your contact number">
        </div>

        <div class="rfi-form-group">
          <label for="rfiMessage">Message *</label>
          <textarea id="rfiMessage" name="message"
            maxlength="3000" required
            placeholder="Write your message"></textarea>
        </div>

        <div class="rfi-form-group rfi-captcha-group">
          <label>Captcha Code *</label>

          <div class="rfi-captcha-row">
            <span id="rfiCaptchaQuestion" class="rfi-captcha-question">
              ${captcha.question}
            </span>

            <button
              type="button"
              id="rfiCaptchaRefresh"
              class="rfi-captcha-refresh"
              aria-label="Refresh captcha"
            >
              ↻ Refresh
            </button>
          </div>

          <input
            id="rfiCaptcha"
            name="captcha"
            type="text"
            inputmode="numeric"
            maxlength="3"
            autocomplete="off"
            required
            placeholder="Enter captcha answer"
          >
        </div>

        <div class="rfi-consent">
          <label>
            <input type="checkbox" name="consent" required>

            I consent to collect, store, and process my personal
            information as outlined in the
            <a href="privacy-policy.html"
              target="_blank" rel="noopener">Privacy Policy</a>.
            By clicking on Submit you agree to this.
          </label>
        </div>

        <button type="submit" id="rfiSubmitBtn">Submit</button>

        <p id="rfiStatus" class="rfi-status"
          role="status" aria-live="polite"></p>

      </form>
    </section>
  `;
}

/* =========================================
   SUBMIT REQUEST FOR INFORMATION
========================================= */

async function submitRFI(form) {
  const submitButton = form.querySelector("#rfiSubmitBtn");
  const status = form.querySelector("#rfiStatus");

  if (!form.reportValidity()) return;

  const formData = new FormData(form);

  const captchaEntered = String(
    formData.get("captcha") || ""
  ).trim();

  const captchaCorrect = String(
    form.dataset.captchaAnswer || ""
  );

  if (!captchaEntered || captchaEntered !== captchaCorrect) {
    if (status) {
      status.textContent = "Incorrect Captcha Code. Please try again.";
      status.style.color = "#dc2626";
    }

    refreshRFICaptcha(form);
    return;
  }

  const consent = formData.get("consent") === "on";

  if (!consent) {
    if (status) {
      status.textContent = "Please accept the Privacy Policy.";
      status.style.color = "#dc2626";
    }
    return;
  }

  const phone = String(formData.get("phone") || "").trim();

  if (!/^[0-9+\-\s()]{7,25}$/.test(phone)) {
    if (status) {
      status.textContent = "Please enter a valid contact number.";
      status.style.color = "#dc2626";
    }
    return;
  }

  const enquiry = {
    enquiryType: "Product Request for Information",
    source: "Website Product RFI",

    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    company: String(formData.get("company") || "").trim(),
    country: String(formData.get("country") || "").trim(),
    state: String(formData.get("state") || "").trim(),
    city: String(formData.get("city") || "").trim(),
    phone,
    mobile: phone,
    message: String(formData.get("message") || "").trim(),

    productName: String(formData.get("productName") || "").trim(),
    productModel: String(formData.get("productModel") || "").trim(),

    customerId: String(formData.get("customerId") || "").trim(),
    customerProductId: String(
      formData.get("customerProductId") || ""
    ).trim(),

    consent: true,
    privacyAccepted: true,
    read: false,
    status: "New",
    createdAt: serverTimestamp()
  };

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";
  }

  if (status) {
    status.textContent = "Submitting your enquiry...";
    status.style.color = "#555";
  }

  try {
    await addDoc(collection(db, "enquiries"), enquiry);

    if (status) {
      status.textContent =
        "Thank you! Your enquiry has been submitted successfully.";
      status.style.color = "#087f3c";
    }

    form.reset();
    refreshRFICaptcha(form);

  } catch (error) {
    console.error("Enquiry submission error:", error);

    if (status) {
      status.textContent =
        "Enquiry could not be submitted. Please try again later.";
      status.style.color = "#dc2626";
    }

    refreshRFICaptcha(form);

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Submit";
    }
  }
}

/* =========================================
   PRODUCT DETAILS MODAL
========================================= */

function openProductDetails(index) {
  const product = allProducts[index];

  if (!product || !productModal || !modalContent) return;

  const name = getProductName(product);
  const image = getProductImage(product);
  const category = getProductCategory(product);
  const model = getProductModel(product);
  const price = getProductPrice(product);

  const description = String(product.description || "").trim();
  const note = String(product.note || product.notes || "").trim();

  const features = getProductFeatures(product);
  const specifications = getProductSpecifications(product);

  modalContent.innerHTML = `
    <div class="product-detail-page">

      <div class="product-detail-navigation">
        <a href="#Specification">Specification</a>
        <a href="#RequestInformation">Request for Information</a>
      </div>

      <div class="modal-product-layout">

        <div class="modal-product-image">
          <img
            src="${escapeHTML(image)}"
            alt="${escapeHTML(name)}"
            onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}'"
          >
        </div>

        <div class="modal-product-info">

          <span>${escapeHTML(category)}</span>

          <h2>${escapeHTML(name)}</h2>

          ${model ? `
            <p><strong>Model:</strong> ${escapeHTML(model)}</p>
          ` : ""}

          ${price ? `
            <p><strong>Price:</strong> ${escapeHTML(price)}</p>
          ` : ""}

          ${description ? `
            <p>${escapeHTML(description)}</p>
          ` : ""}

          ${features.length ? `
            <div class="product-features">
              <h3>Features</h3>
              <ul>
                ${features.map(feature => `
                  <li>${escapeHTML(feature)}</li>
                `).join("")}
              </ul>
            </div>
          ` : ""}

          <button type="button" id="modalEnquireBtn">
            Enquire on WhatsApp
          </button>

        </div>
      </div>

      <section class="product-specifications" id="Specification">

        <h2>Specification</h2>

        ${
          specifications.length
            ? `
              <div class="specification-table-wrapper">
                <table class="specification-table">
                  <tbody>
                    ${specifications.map(item => `
                      <tr>
                        <th>${escapeHTML(item.label)}</th>
                        <td>${escapeHTML(item.value)}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            `
            : `
              <p class="specification-empty">
                Product specifications have not been added yet.
                Please update this product's specifications from Admin Panel.
              </p>
            `
        }

      </section>

      ${note ? `
        <div class="product-additional-note">
          <h3>Additional Note</h3>
          <p>${escapeHTML(note)}</p>
        </div>
      ` : ""}

      ${createRFIForm(product)}

    </div>
  `;

  productModal.classList.add("active");
  productModal.style.display = "flex";

  // Modal ko shuru se dikhayein
  modalContent.scrollTop = 0;

  document.getElementById("modalEnquireBtn")
    ?.addEventListener("click", () => {
      openWhatsApp(
        "Hello RB Tech Solution,\\nI want details about:\\n" +
        name +
        (model ? "\\nModel: " + model : "")
      );
    });

  // RFI form submit
  const rfiForm = modalContent.querySelector("#rfiForm");

  rfiForm?.addEventListener("submit", event => {
    event.preventDefault();
    submitRFI(event.currentTarget);
  });

  // Captcha refresh
  rfiForm?.querySelector("#rfiCaptchaRefresh")
    ?.addEventListener("click", () => {
      refreshRFICaptcha(rfiForm);
    });

  // Specification / RFI links
  modalContent.querySelectorAll(".product-detail-navigation a")
    .forEach(link => {
      link.addEventListener("click", event => {
        event.preventDefault();

        const target = modalContent.querySelector(
          link.getAttribute("href")
        );

        target?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    });
}

/* =========================================
   CLOSE PRODUCT DETAILS MODAL
========================================= */

function closeProductModal() {
  if (!productModal) return;

  productModal.classList.remove("active");
  productModal.style.display = "none";
}

// Close button
modalClose?.addEventListener("click", closeProductModal);

// Modal ke bahar click karne par close
productModal?.addEventListener("click", event => {
  if (event.target === productModal) {
    closeProductModal();
  }
});

// Escape key se close
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeProductModal();
  }
});

/* =========================================
   HERO SLIDESHOW
========================================= */

function startHeroSlideshow() {
  const heroBox = document.querySelector(".hero-image-box");
  if (!heroBox) return;

  if (heroSlideTimer) {
    clearInterval(heroSlideTimer);
    heroSlideTimer = null;
  }

  Array.from(heroBox.children).forEach(child => {
    if (child.tagName === "IMG") child.remove();
  });

  const label = heroBox.querySelector(".hero-image-label");
  const images = [];

  allProducts.forEach(product => {
    const image = getProductImage(product);
    if (image && !images.includes(image)) images.push(image);
  });

  if (!images.includes(DEFAULT_IMAGE)) images.push(DEFAULT_IMAGE);

  const slides = images.slice(0, 6);

  const slideElements = slides.map((image, index) => {
    const slide = document.createElement("img");

    slide.src = image;
    slide.alt = "RB Tech Solution CCTV and Security Products";
    slide.className = "hero-slideshow-image";
    slide.loading = index === 0 ? "eager" : "lazy";

    if (index === 0) slide.classList.add("active");

    slide.onerror = () => {
      slide.style.display = "none";
    };

    if (label) {
      heroBox.insertBefore(slide, label);
    } else {
      heroBox.appendChild(slide);
    }

    return slide;
  });

  if (slideElements.length < 2) return;

  let currentSlide = 0;

  heroSlideTimer = setInterval(() => {
    slideElements[currentSlide].classList.remove("active");

    currentSlide = (currentSlide + 1) % slideElements.length;

    slideElements[currentSlide].classList.add("active");
  }, 4000);
}

/* =========================================
   CATEGORY NAVIGATION EVENTS
========================================= */

document.querySelectorAll("[data-category]").forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    selectProductCategory(link.dataset.category || "");
  });
});

/* =========================================
   PRODUCT BUTTON AND PHOTO EVENTS
========================================= */

document.addEventListener("click", event => {
  const detailsButton = event.target.closest("[data-product-index]");
  const enquireButton = event.target.closest("[data-enquire-index]");

  if (detailsButton) {
    openProductDetails(Number(detailsButton.dataset.productIndex));
  }

  if (enquireButton) {
    const product = allProducts[
      Number(enquireButton.dataset.enquireIndex)
    ];

    if (product) {
      const model = getProductModel(product);

      openWhatsApp(
        "Hello RB Tech Solution,\nI want to enquire about:\n" +
        getProductName(product) +
        (model ? "\nModel: " + model : "")
      );
    }
  }
});

/* =========================================
   PRODUCT PHOTO KEYBOARD SUPPORT
========================================= */

document.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;

  const imageBox = event.target.closest(
    ".product-image[data-product-index]"
  );

  if (!imageBox) return;

  event.preventDefault();
  openProductDetails(Number(imageBox.dataset.productIndex));
});

/* =========================================
   CONTACT FORM WHATSAPP
========================================= */

enquiryWhatsApp?.addEventListener("click", () => {
  const name = enquiryName?.value.trim() || "";
  const product = enquiryProduct?.value.trim() || "";
  const message = enquiryMessage?.value.trim() || "";

  if (!name || !message) {
    alert("Please enter your name and message.");
    return;
  }

  openWhatsApp(
    "RB Tech Solution Website Enquiry\n\n" +
    "Name: " + name +
    "\nProduct: " + product +
    "\nMessage: " + message
  );
});

/* =========================================
   SEARCH AND CATEGORY FILTER EVENTS
========================================= */

searchInput?.addEventListener("input", filterProducts);
categoryFilter?.addEventListener("change", filterProducts);

/* =========================================
   FIRESTORE PRODUCTS
   Old products + Customer Admin products
========================================= */

async function loadProducts() {
  if (productGrid) {
    productGrid.innerHTML = "<p>Loading products...</p>";
  }

  try {
    const [oldProductsSnapshot, customerProductsSnapshot] =
      await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "customerProducts"))
      ]);

    const oldProducts = oldProductsSnapshot.docs.map(item => ({
      id: item.id,
      ...item.data(),
      productSource: "website"
    }));

    const customerProducts = customerProductsSnapshot.docs
      .map(item => ({
        id: item.id,
        ...item.data(),
        productSource: "customer"
      }))
      .filter(product => product.active !== false);

    allProducts = [
      ...oldProducts.filter(product => product.active !== false),
      ...customerProducts
    ];

    displayProducts();
    displayTrendingProducts();
    setupTrendingCarousel();
    createOfferCategoryCards();
    startHeroSlideshow();

  } catch (error) {
    console.error("Product loading error:", error);

    if (productGrid) {
      productGrid.innerHTML =
        "<p>Unable to load products. Please try again later.</p>";
    }
  }
}

/* =========================================
   FOOTER YEAR
========================================= */

const footerYear = document.getElementById("footerYear");

if (footerYear) {
  footerYear.textContent = new Date().getFullYear();
}

/* =========================================
   WEBSITE CONTACT ENQUIRY FORM
   Saves customerId for customer products
========================================= */

function setupWebsiteInquiryForm() {
  const form = document.getElementById("websiteInquiryForm");

  if (!form) {
    console.warn("Website enquiry form not found.");
    return;
  }

  const submitButton = document.getElementById("websiteInquirySubmit");
  const statusBox = document.getElementById("websiteInquiryStatus");

  function showStatus(message, success = false) {
    if (!statusBox) {
      alert(message);
      return;
    }

    statusBox.textContent = message;
    statusBox.style.display = "block";
    statusBox.style.color = success ? "#087f3c" : "#d93025";
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const name =
      document.getElementById("websiteInquiryName")?.value.trim() || "";

    const email =
      document.getElementById("websiteInquiryEmail")?.value.trim() || "";

    const mobile =
      document.getElementById("websiteInquiryMobile")?.value.trim() || "";

    const product =
      document.getElementById("websiteInquiryProduct")?.value.trim() || "";

    const country =
      document.getElementById("contactCountry")?.value.trim() || "";

    const state =
      document.getElementById("contactState")?.value.trim() || "";

    const city =
      document.getElementById("contactCity")?.value.trim() || "";

    const pincode =
      document.getElementById("contactPincode")?.value.trim() || "";

    const message =
      document.getElementById("websiteInquiryMessage")?.value.trim() || "";

    const privacyAccepted =
      document.getElementById("contactPrivacy")?.checked || false;

    if (!name || !mobile || !product || !message) {
      showStatus("Please fill all required fields.");
      return;
    }

    if (!privacyAccepted) {
      showStatus("Please accept the privacy policy.");
      return;
    }

    if (!/^[0-9+\-\s()]{7,20}$/.test(mobile)) {
      showStatus("Please enter a valid mobile number.");
      return;
    }

    const matchedProduct = findProductByName(product);

    const enquiryData = {
      enquiryType: "Website Contact Enquiry",

      name,
      email,
      mobile,
      product,

      country,
      state,
      city,
      pincode,
      message,

      privacyAccepted,

      customerId: getCustomerId(matchedProduct),
      customerProductId: getCustomerProductId(matchedProduct),

      read: false,
      status: "New",
      source: "Website Contact Popup",
      createdAt: serverTimestamp()
    };

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";
      }

      showStatus("Submitting your enquiry...");

      const docRef = await addDoc(
        collection(db, "enquiries"),
        enquiryData
      );

      console.log("Website enquiry saved:", docRef.id);

      showStatus(
        "Thank you! Your enquiry has been submitted successfully.",
        true
      );

      form.reset();

      document
        .getElementById("contactCaptchaRefresh")
        ?.click();

    } catch (error) {
      console.error("Website enquiry error:", error);

      showStatus(
        "Unable to submit your enquiry. Please try again."
      );

    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Enquiry";
      }
    }
  });
}

setupWebsiteInquiryForm();

/* =========================================
   START WEBSITE
========================================= */

loadProducts();
