
import {
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import { db } from "./firebase.js";

const productGrid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");

const productModal = document.getElementById("productModal");
const modalContent = document.getElementById("modalContent");
const modalClose = document.getElementById("modalClose");

let allProducts = [];

const WHATSAPP_NUMBER = "91XXXXXXXXXX";

// HTML Security
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

// Load Products from Firebase
function loadProducts() {

  productGrid.innerHTML = `
    <p>Loading security products...</p>
  `;

  const productsQuery = query(
    collection(db, "products"),
    where("active", "==", true)
  );

  onSnapshot(productsQuery, snapshot => {

    allProducts = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    displayProducts();

  }, error => {

    console.error("Product loading error:", error);

    productGrid.innerHTML = `
      <p>Unable to load products. Please try again later.</p>
    `;

  });
}

// Display Products
function displayProducts() {

  const search = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;

  const filtered = allProducts.filter(product => {

    const matchesSearch = (
      (product.name || "").toLowerCase().includes(search) ||
      (product.model || "").toLowerCase().includes(search) ||
      (product.category || "").toLowerCase().includes(search) ||
      (product.description || "").toLowerCase().includes(search)
    );

    const matchesCategory =
      category === "all" ||
      product.category === category;

    return matchesSearch && matchesCategory;

  });

  if (!filtered.length) {

    productGrid.innerHTML = `
      <div class="empty-products">
        <h3>No Products Found</h3>
        <p>Please try another search or category.</p>
      </div>
    `;

    return;
  }

  productGrid.innerHTML = filtered.map(product => {

    const price = product.price === null ||
      product.price === undefined ||
      product.price === ""
      ? "Contact for Price"
      : "₹" + Number(product.price).toLocaleString("en-IN");

    return `
      <article class="product-card">

        <div class="product-art">

          ${
            product.imageUrl
              ? `<img src="${escapeHTML(product.imageUrl)}"
                  alt="${escapeHTML(product.name)}"
                  loading="lazy">`
              : `<span class="art-icon">📹</span>`
          }

        </div>

        <div class="product-info">

          <small>${escapeHTML(product.category)}</small>

          <h3>${escapeHTML(product.name)}</h3>

          <p>
            Model: ${escapeHTML(product.model || "Contact Us")}
          </p>

          <strong>${price}</strong>

          <div class="product-actions">

            <button
              type="button"
              data-details="${escapeHTML(product.id)}"
            >
              VIEW DETAILS →
            </button>

          </div>

        </div>

      </article>
    `;

  }).join("");

}

// Product Details
productGrid.addEventListener("click", event => {

  const button = event.target.closest("[data-details]");

  if (!button) return;

  const product = allProducts.find(
    item => item.id === button.dataset.details
  );

  if (!product) return;

  const price = product.price === null ||
    product.price === undefined ||
    product.price === ""
    ? "Contact for Price"
    : "₹" + Number(product.price).toLocaleString("en-IN");

  const message = encodeURIComponent(
    `Hello RB Tech Solution, I want details about ${product.name}, Model: ${product.model || "Not specified"}.`
  );

  modalContent.innerHTML = `

    <p class="eyebrow">
      ${escapeHTML(product.category)}
    </p>

    ${
      product.imageUrl
        ? `<img src="${escapeHTML(product.imageUrl)}"
            alt="${escapeHTML(product.name)}"
            style="width:100%;max-height:260px;object-fit:contain">`
        : ""
    }

    <h2>${escapeHTML(product.name)}</h2>

    <p><b>Model:</b> ${escapeHTML(product.model || "Contact Us")}</p>

    <p><b>Price:</b> ${price}</p>

    <p>${escapeHTML(product.description || "")}</p>

    <a
      class="btn primary"
      target="_blank"
      rel="noopener"
      href="https://wa.me/${WHATSAPP_NUMBER}?text=${message}"
    >
      Enquire on WhatsApp
    </a>

  `;

  productModal.classList.add("show");

});

// Search
searchInput.addEventListener("input", displayProducts);

// Category Filter
categoryFilter.addEventListener("change", displayProducts);

// Close Modal
modalClose.addEventListener("click", () => {
  productModal.classList.remove("show");
});

productModal.addEventListener("click", event => {

  if (event.target === productModal) {
    productModal.classList.remove("show");
  }

});

// Mobile Menu
document.getElementById("menuToggle")?.addEventListener("click", () => {
  document.getElementById("mainNav").classList.toggle("open");
});

// Current Year
document.getElementById("year").textContent =
  new Date().getFullYear();

// Start
loadProducts();
