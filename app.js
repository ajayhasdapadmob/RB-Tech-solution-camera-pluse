
const productGrid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const productModal = document.getElementById("productModal");
const modalContent = document.getElementById("modalContent");
const modalClose = document.getElementById("modalClose");

const WHATSAPP_NUMBER = "91XXXXXXXXXX";

const githubProducts = [
  {
    id: "github-camera-01",
    name: "CCTV Security Camera",
    category: "CCTV Cameras",
    model: "Contact Us",
    price: "",
    description: "RB Tech Solution CCTV Security Camera. Contact us for product details and pricing.",
    imageUrl: "https://ajayhasdapadmob.github.io/RB-Tech-solution-camera-pluse/images/products/jaise%20camera-01.jpg.png",
    active: true
  }
];

let allProducts = [...githubProducts];

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function displayProducts() {
  if (!productGrid) return;

  const search = searchInput?.value.trim().toLowerCase() || "";
  const category = categoryFilter?.value || "all";

  const filtered = allProducts.filter(product => {
    const matchesSearch = [
      product.name,
      product.model,
      product.category,
      product.description
    ].some(value => String(value || "").toLowerCase().includes(search));

    const matchesCategory =
      category === "all" || product.category === category;

    return matchesSearch && matchesCategory && product.active !== false;
  });

  if (!filtered.length) {
    productGrid.innerHTML = `
      <div class="empty-products">
        <h3>No Products Found</h3>
        <p>Please try another search or category.</p>
      </div>`;
    return;
  }

  productGrid.innerHTML = filtered.map(product => {
    const price = !product.price || Number(product.price) === 0
      ? "Contact for Price"
      : "₹" + Number(product.price).toLocaleString("en-IN");

    return `
      <article class="product-card">
        <div class="product-art">
          <img
            src="${escapeHTML(product.imageUrl || "")}"
            alt="${escapeHTML(product.name)}"
            loading="lazy"
            onerror="this.style.display='none';this.parentElement.innerHTML='<span class=\\'art-icon\\'>📹</span>'"
          >
        </div>
        <div class="product-info">
          <small>${escapeHTML(product.category)}</small>
          <h3>${escapeHTML(product.name)}</h3>
          <p>Model: ${escapeHTML(product.model || "Contact Us")}</p>
          <strong>${price}</strong>
          <div class="product-actions">
            <button type="button" data-details="${escapeHTML(product.id)}">
              VIEW DETAILS →
            </button>
          </div>
        </div>
      </article>`;
  }).join("");
}

// Show GitHub product immediately, without waiting for Firebase.
displayProducts();

// Load Firestore products separately.
async function loadFirebaseProducts() {
  try {
    const [{ collection, query, where, getDocs }, { db }] =
      await Promise.all([
        import("https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js"),
        import("./firebase.js")
      ]);

    const productsQuery = query(
      collection(db, "products"),
      where("active", "==", true)
    );

    const snapshot = await getDocs(productsQuery);

    const firebaseProducts = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    allProducts = [
      ...githubProducts,
      ...firebaseProducts.filter(
        product => !githubProducts.some(item => item.id === product.id)
      )
    ];

    displayProducts();

  } catch (error) {
    console.error("Firebase loading error:", error);
    allProducts = [...githubProducts];
    displayProducts();
  }
}

productGrid?.addEventListener("click", event => {
  const button = event.target.closest("[data-details]");
  if (!button) return;

  const product = allProducts.find(
    item => item.id === button.dataset.details
  );

  if (!product || !modalContent || !productModal) return;

  const price = !product.price || Number(product.price) === 0
    ? "Contact for Price"
    : "₹" + Number(product.price).toLocaleString("en-IN");

  const message = encodeURIComponent(
    `Hello RB Tech Solution, I want details about ${product.name}, Model: ${product.model || "Not specified"}.`
  );

  modalContent.innerHTML = `
    <p class="eyebrow">${escapeHTML(product.category)}</p>
    <img
      src="${escapeHTML(product.imageUrl || "")}"
      alt="${escapeHTML(product.name)}"
      style="width:100%;max-height:260px;object-fit:contain"
    >
    <h2>${escapeHTML(product.name)}</h2>
    <p><b>Model:</b> ${escapeHTML(product.model || "Contact Us")}</p>
    <p><b>Price:</b> ${price}</p>
    <p>${escapeHTML(product.description || "")}</p>
    <a class="btn primary"
       target="_blank"
       rel="noopener"
       href="https://wa.me/${WHATSAPP_NUMBER}?text=${message}">
       Enquire on WhatsApp
    </a>`;

  productModal.classList.add("show");
});

searchInput?.addEventListener("input", displayProducts);
categoryFilter?.addEventListener("change", displayProducts);

modalClose?.addEventListener("click", () => {
  productModal?.classList.remove("show");
});

productModal?.addEventListener("click", event => {
  if (event.target === productModal) {
    productModal.classList.remove("show");
  }
});

document.getElementById("menuToggle")?.addEventListener("click", () => {
  document.getElementById("mainNav")?.classList.toggle("open");
});

const yearElement = document.getElementById("year");
if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

loadFirebaseProducts();
