
const productGrid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");

const WHATSAPP_NUMBER = "91XXXXXXXXXX";

const githubProducts = [
  {
    id: "github-camera-01",
    name: "CCTV Security Camera",
    category: "CCTV Cameras",
    model: "Contact Us",
    price: "",
    description:
      "RB Tech Solution CCTV Security Camera. Contact us for product details and pricing.",
    imageUrl:
      "https://ajayhasdapadmob.github.io/RB-Tech-solution-camera-pluse/images/products/jaise%20camera-01.jpg.png",
    images: [],
    features: [],
    specifications: [],
    datasheetUrl: "",
    manualUrl: "",
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
    ].some(value =>
      String(value || "").toLowerCase().includes(search)
    );

    const matchesCategory =
      category === "all" || product.category === category;

    return matchesSearch &&
      matchesCategory &&
      product.active !== false;
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
    const price =
      !product.price || Number(product.price) === 0
        ? "Contact for Price"
        : "₹" + Number(product.price).toLocaleString("en-IN");

    const detailUrl =
      "product.html?id=" + encodeURIComponent(product.id);

    return `
      <article class="product-card">

        <a class="product-art"
           href="${detailUrl}"
           aria-label="View ${escapeHTML(product.name)} details">

          <img
            src="${escapeHTML(product.imageUrl || "")}"
            alt="${escapeHTML(product.name)}"
            loading="lazy"
            onerror="this.style.display='none';this.parentElement.innerHTML='<span class=\\'art-icon\\'>📹</span>'"
          >

        </a>

        <div class="product-info">

          <small>${escapeHTML(product.category)}</small>

          <h3>${escapeHTML(product.name)}</h3>

          <p>Model: ${escapeHTML(product.model || "Contact Us")}</p>

          <strong>${price}</strong>

          <div class="product-actions">

            <a
              href="${detailUrl}"
              class="product-detail-link"
            >
              VIEW DETAILS →
            </a>

          </div>

        </div>
      </article>`;
  }).join("");
}

// Show GitHub product immediately.
displayProducts();

// Load products from Firestore.
async function loadFirebaseProducts() {
  try {
    const [
      { collection, query, where, getDocs },
      { db }
    ] = await Promise.all([
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
        product =>
          !githubProducts.some(item => item.id === product.id)
      )
    ];

    displayProducts();

  } catch (error) {
    console.error("Firebase loading error:", error);

    allProducts = [...githubProducts];
    displayProducts();
  }
}

// Product search and category filter.
searchInput?.addEventListener("input", displayProducts);
categoryFilter?.addEventListener("change", displayProducts);

// Mobile navigation.
document.getElementById("menuToggle")?.addEventListener("click", () => {
  document.getElementById("mainNav")?.classList.toggle("open");
});

// Close mobile navigation after selecting a link.
document.querySelectorAll("#mainNav a").forEach(link => {
  link.addEventListener("click", () => {
    document.getElementById("mainNav")?.classList.remove("open");
  });
});

// Footer year.
const yearElement = document.getElementById("year");

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

// Start loading Firestore products.
loadFirebaseProducts();
