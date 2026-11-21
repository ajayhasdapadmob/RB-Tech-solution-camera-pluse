
import { db } from "./firebase.js";

import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

console.log("RB Marketing JS Loaded Successfully");

/* =====================================
   CONFIGURATION
===================================== */

const MARKETING_COLLECTION = "marketingItems";

const SECTION_CONFIG = {
  companyNews: { grid: "companyNewsGrid" },
  brochures: { grid: "brochuresGrid" },
  videos: { grid: "videosGrid" },
  gallery: { grid: "galleryGrid" },
  printPress: { grid: "printPressGrid" }
};

const $ = id => document.getElementById(id);

/* =====================================
   TENANT / DOMAIN SETTINGS
===================================== */

let marketingTenantId = "";
let marketingTenantUid = "";
let marketingWebsiteMode = "blocked";

const LEGACY_HOSTS = [
  "rb-tech-solution-camera-pluse.pages.dev",
  "ajayhasdapadmob.github.io",
  "localhost",
  "127.0.0.1"
];

/* =====================================
   COMMON FUNCTIONS
===================================== */

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function safeURL(value) {
  try {
    const url = new URL(String(value || ""));

    return ["https:", "http:"].includes(url.protocol)
      ? url.href
      : "";
  } catch {
    return "";
  }
}

function formatDate(value) {
  if (!value) return "";

  const date = value.toDate
    ? value.toDate()
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getText(item) {
  return item.description || item.content || "";
}

function getImage(item) {
  return safeURL(
    item.thumbnailUrl ||
    item.mediaUrl ||
    item.imageUrl ||
    item.image ||
    item.photo
  );
}

/* =====================================
   GALLERY DUPLICATE PROTECTION
===================================== */

function getGalleryImageKey(item) {
  const publicId = String(item?.publicId || "").trim();

  if (publicId) {
    return "cloudinary:" + publicId.toLowerCase();
  }

  const image = safeURL(
    item?.mediaUrl ||
    item?.thumbnailUrl ||
    item?.imageUrl ||
    item?.image ||
    item?.photo
  );

  if (!image) return "";

  try {
    const url = new URL(image);

    return (
      url.hostname.toLowerCase() +
      url.pathname.toLowerCase()
    );
  } catch {
    return image.toLowerCase();
  }
}

function getUniqueGalleryItems(items = []) {
  const seen = new Set();
  const unique = [];

  items.forEach(item => {
    const key = getGalleryImageKey(item);

    if (!key || seen.has(key)) return;

    seen.add(key);
    unique.push(item);
  });

  return unique;
}

/* =====================================
   MARKETING VIEWER
===================================== */

function getViewerElements() {
  return {
    viewer: $("marketingViewer"),
    content: $("marketingViewerContent")
  };
}

function openMarketingViewer(html) {
  const { viewer, content } = getViewerElements();

  if (!viewer || !content) return;

  content.innerHTML = html;
  viewer.classList.add("active");

  document.body.style.overflow = "hidden";
}

function closeMarketingViewer() {
  const { viewer, content } = getViewerElements();

  if (!viewer) return;

  viewer.classList.remove("active");

  if (content) {
    content.querySelectorAll("video").forEach(video => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    });

    content.innerHTML = "";
  }

  document.body.style.overflow = "";
}

/* =====================================
   SHOW ARTICLE
===================================== */

function showArticle(item) {
  const title = escapeHTML(item.title || "Untitled");
  const description = escapeHTML(getText(item));
  const date = escapeHTML(formatDate(item.createdAt));
  const image = getImage(item);

  openMarketingViewer(`
    ${image
      ? `<img src="${escapeHTML(image)}" alt="${title}">`
      : ""}

    <h2>${title}</h2>

    ${date ? `<p>${date}</p>` : ""}

    <div style="text-align:left;line-height:1.8;white-space:pre-line">
      ${description}
    </div>
  `);
}

/* =====================================
   SHOW GALLERY IMAGE
===================================== */

function showImage(item) {
  const image = safeURL(
    item.mediaUrl ||
    item.thumbnailUrl ||
    item.imageUrl ||
    item.image ||
    item.photo
  );

  if (!image) return;

  openMarketingViewer(`
    <img
      src="${escapeHTML(image)}"
      alt="${escapeHTML(item.title || "Gallery image")}">

    ${item.title
      ? `<h2>${escapeHTML(item.title)}</h2>`
      : ""}

    ${getText(item)
      ? `<p>${escapeHTML(getText(item))}</p>`
      : ""}
  `);
}

/* =====================================
   SHOW VIDEO
===================================== */

function showVideo(item) {
  const video = safeURL(item.mediaUrl);

  if (!video) return;

  const title = escapeHTML(item.title || "Video");

  openMarketingViewer(`
    <h2>${title}</h2>

    <video
      controls
      autoplay
      playsinline
      poster="${escapeHTML(getImage(item))}"
      style="width:100%;background:#000">

      <source src="${escapeHTML(video)}">
      Your browser does not support video playback.
    </video>

    ${getText(item)
      ? `<p>${escapeHTML(getText(item))}</p>`
      : ""}
  `);
}

/* =====================================
   CREATE MARKETING CARD
===================================== */

function createCard(item, type, index) {
  const title = escapeHTML(item.title || "Untitled");
  const description = escapeHTML(getText(item));
  const image = getImage(item);

  const card = document.createElement("article");

  card.className = "marketing-item";
  card.dataset.marketingIndex = index;
  card.dataset.marketingType = type;

  if (item.productSource) {
    card.dataset.productSource = item.productSource;
  }

  let mediaHTML = "";

  if (type === "videos") {
    const videoURL = safeURL(item.mediaUrl);

    mediaHTML = videoURL
      ? `
        <video
          src="${escapeHTML(videoURL)}"
          poster="${escapeHTML(image)}"
          autoplay
          muted
          loop
          playsinline
          webkit-playsinline
          preload="auto"
          disablepictureinpicture
          style="width:100%;height:190px;object-fit:cover;background:#000">
        </video>
      `
      : `
        <div style="height:190px;display:grid;place-items:center;background:#edf5ee">
          Video unavailable
        </div>
      `;
  } else if (image) {
    mediaHTML = `
      <img
        src="${escapeHTML(image)}"
        alt="${title}"
        loading="lazy">
    `;
  }

  let actionHTML = "";

  if (type === "brochures") {
    const fileURL = safeURL(item.mediaUrl);

    actionHTML = fileURL
      ? `
        <a
          href="${escapeHTML(fileURL)}"
          target="_blank"
          rel="noopener">
          View / Download PDF
        </a>
      `
      : "";
  }

  card.innerHTML = `
    ${mediaHTML}

    <div class="marketing-item-body">
      <h3>${title}</h3>

      ${type !== "videos" && description
        ? `
          <p>
            ${description.length > 160
              ? description.slice(0, 160) + "..."
              : description}
          </p>
        `
        : ""}

      ${actionHTML}
    </div>
  `;

  if (type === "videos") {
    const video = card.querySelector("video");

    if (video) {
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;

      video.play().catch(error => {
        console.log("Video autoplay issue:", error);
      });
    }
  }

  if (
    type === "gallery" ||
    type === "companyNews" ||
    type === "printPress"
  ) {
    const photo = card.querySelector("img");

    if (photo) {
      photo.style.cursor = "pointer";
    }
  }

  return card;
}

/* =====================================
   GALLERY SLIDER
===================================== */

function renderGallerySlider(grid, items) {
  const uniqueGallery = getUniqueGalleryItems(items);

  if (!uniqueGallery.length) return;

  const slider = document.createElement("div");
  slider.className = "marketing-gallery-slider";
  slider.style.position = "relative";
  slider.style.width = "100%";

  const viewport = document.createElement("div");
  viewport.className = "marketing-gallery-viewport";
  viewport.style.width = "100%";
  viewport.style.overflow = "hidden";

  const track = document.createElement("div");
  track.className = "marketing-gallery-track";

  track.style.display = "flex";
  track.style.gap = "20px";
  track.style.width = "max-content";
  track.style.transition = "transform 0.6s ease";
  track.style.willChange = "transform";

  viewport.appendChild(track);
  slider.appendChild(viewport);
  grid.appendChild(slider);

  const cards = uniqueGallery.map((item, index) => {
    const card = createCard(item, "gallery", index);

    card.style.boxSizing = "border-box";
    card.style.minWidth = "0";

    const photo = card.querySelector("img");

    if (photo) {
      photo.style.width = "100%";
      photo.style.height = "190px";
      photo.style.objectFit = "cover";
      photo.style.display = "block";
      photo.style.cursor = "pointer";
    }

    return card;
  });

  let visibleCount = 3;
  let position = 0;
  let timer = null;
  const gap = 20;

  const left = document.createElement("button");
  left.type = "button";
  left.className = "marketing-arrow marketing-left";
  left.textContent = "❮";
  left.setAttribute("aria-label", "Previous photo");

  const right = document.createElement("button");
  right.type = "button";
  right.className = "marketing-arrow marketing-right";
  right.textContent = "❯";
  right.setAttribute("aria-label", "Next photo");

  [left, right].forEach(button => {
    button.style.position = "absolute";
    button.style.top = "50%";
    button.style.transform = "translateY(-50%)";
    button.style.zIndex = "10";
    button.style.width = "42px";
    button.style.height = "42px";
    button.style.border = "none";
    button.style.borderRadius = "50%";
    button.style.background = "#075b30";
    button.style.color = "#fff";
    button.style.fontSize = "22px";
    button.style.cursor = "pointer";
  });

  left.style.left = "10px";
  right.style.right = "10px";

  slider.append(left, right);

  function stopAuto() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function move(direction) {
    if (cards.length <= visibleCount) return;

    position += direction;

    if (position >= cards.length) {
      position = 0;
    }

    if (position < 0) {
      position = cards.length - 1;
    }

    const cardWidth = cards[0].offsetWidth + gap;

    track.style.transform =
      `translate3d(-${position * cardWidth}px,0,0)`;
  }

  function startAuto() {
    stopAuto();

    if (cards.length <= visibleCount) return;

    timer = setInterval(() => {
      move(1);
    }, 3000);
  }

  function rebuild() {
    stopAuto();

    const width = viewport.clientWidth;
    if (!width) return;

    if (window.innerWidth <= 480) {
      visibleCount = 1;
    } else if (window.innerWidth <= 768) {
      visibleCount = 2;
    } else {
      visibleCount = 3;
    }

    visibleCount = Math.min(visibleCount, cards.length);
    position = 0;

    track.style.transition = "none";
    track.replaceChildren(...cards);

    const cardWidth =
      (width - gap * (visibleCount - 1)) / visibleCount;

    cards.forEach(card => {
      card.style.flex = `0 0 ${cardWidth}px`;
      card.style.width = `${cardWidth}px`;
    });

    track.style.transform = "translate3d(0,0,0)";

    requestAnimationFrame(() => {
      track.style.transition = "transform 0.6s ease";
    });

    const canMove = cards.length > visibleCount;

    left.style.display = canMove ? "block" : "none";
    right.style.display = canMove ? "block" : "none";

    startAuto();
  }

  left.addEventListener("click", () => move(-1));
  right.addEventListener("click", () => move(1));

  slider.addEventListener("mouseenter", stopAuto);
  slider.addEventListener("mouseleave", startAuto);

  track.addEventListener("click", event => {
    if (event.target.closest("a, button")) return;

    const card = event.target.closest(".marketing-item");
    if (!card) return;

    const index = Number(card.dataset.marketingIndex);
    const item = uniqueGallery[index];

    if (item) showImage(item);
  });

  let resizeTimer = null;

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(rebuild, 200);
  });

  requestAnimationFrame(rebuild);

  console.log(
    "Gallery slider initialized:",
    uniqueGallery.length,
    "unique photos"
  );
}

/* =====================================
   OTHER SECTION SLIDER
===================================== */

function renderNormalSlider(grid, type, items) {
  const slider = document.createElement("div");
  slider.className = "marketing-slider";

  const viewport = document.createElement("div");
  viewport.className = "marketing-slider-viewport";

  const track = document.createElement("div");
  track.className = "marketing-slider-track";

  const group1 = document.createElement("div");
  group1.className = "marketing-slider-group";

  viewport.appendChild(track);
  slider.appendChild(viewport);
  grid.appendChild(slider);
  track.appendChild(group1);

  function fillGroup(group) {
    let index = 0;
    const targetWidth = viewport.clientWidth + 300;

    while (
      group.scrollWidth < targetWidth ||
      group.children.length === 0
    ) {
      group.appendChild(
        createCard(
          items[index % items.length],
          type,
          index % items.length
        )
      );

      index++;

      if (index > 500) break;
    }
  }

  fillGroup(group1);

  const group2 = group1.cloneNode(true);
  group2.setAttribute("aria-hidden", "true");
  track.appendChild(group2);

  function playAllVideos() {
    track.querySelectorAll("video").forEach(video => {
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;

      video.play().catch(error => {
        console.log("Video autoplay issue:", error);
      });
    });
  }

  const left = document.createElement("button");
  left.className = "marketing-arrow marketing-left";
  left.type = "button";
  left.textContent = "❮";
  left.setAttribute("aria-label", "Previous");

  const right = document.createElement("button");
  right.className = "marketing-arrow marketing-right";
  right.type = "button";
  right.textContent = "❯";
  right.setAttribute("aria-label", "Next");

  slider.append(left, right);

  let position = 0;
  let groupWidth = 0;
  let frameId = null;
  let lastTime = 0;
  let paused = false;

  const speed = 35;

  function measureSlider() {
    groupWidth = group1.getBoundingClientRect().width;

    if (!groupWidth) return;

    position = -groupWidth;

    track.style.transform =
      `translate3d(${position}px,0,0)`;
  }

  function animate(timestamp) {
    if (paused || !groupWidth) {
      frameId = null;
      return;
    }

    if (!lastTime) lastTime = timestamp;

    const elapsed = Math.min(timestamp - lastTime, 50);
    lastTime = timestamp;

    position += speed * elapsed / 1000;

    if (position >= 0) {
      position -= groupWidth;
    }

    track.style.transform =
      `translate3d(${position}px,0,0)`;

    frameId = requestAnimationFrame(animate);
  }

  function startSlider() {
    if (frameId || !groupWidth) return;

    paused = false;
    lastTime = 0;
    frameId = requestAnimationFrame(animate);
  }

  function stopSlider() {
    paused = true;

    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  }

  function moveCard(direction) {
    const card = group1.querySelector(".marketing-item");

    if (!card || !groupWidth) return;

    const gap = parseFloat(
      getComputedStyle(group1).columnGap
    ) || 20;

    position += direction * (card.offsetWidth + gap);

    if (position >= 0) position -= groupWidth;
    if (position < -groupWidth) position += groupWidth;

    track.style.transform =
      `translate3d(${position}px,0,0)`;
  }

  left.addEventListener("click", () => moveCard(1));
  right.addEventListener("click", () => moveCard(-1));

  slider.addEventListener("mouseenter", stopSlider);
  slider.addEventListener("mouseleave", startSlider);

  track.addEventListener("click", event => {
    const card = event.target.closest(".marketing-item");
    if (!card) return;

    const clickedImage = event.target.closest("img");
    if (!clickedImage) return;

    const index = Number(card.dataset.marketingIndex);
    const item = items[index];

    if (!item) return;

    if (type === "companyNews" || type === "printPress") {
      showArticle(item);
    }
  });

  requestAnimationFrame(() => {
    measureSlider();
    playAllVideos();
    startSlider();
  });

  window.addEventListener("resize", () => {
    stopSlider();
    measureSlider();
    playAllVideos();
    startSlider();
  });
}

/* =====================================
   RENDER MARKETING SECTION
===================================== */

function renderSection(type, items) {
  const config = SECTION_CONFIG[type];
  if (!config) return;

  const grid = $(config.grid);
  if (!grid) return;

  grid.innerHTML = "";

  const filtered = items
    .filter(item =>
      item.type === type &&
      item.active === true
    )
    .sort((a, b) => {
      const aTime = a.createdAt?.toMillis
        ? a.createdAt.toMillis()
        : new Date(a.createdAt || 0).getTime();

      const bTime = b.createdAt?.toMillis
        ? b.createdAt.toMillis()
        : new Date(b.createdAt || 0).getTime();

      return bTime - aTime;
    });

  if (!filtered.length) return;

  if (type === "gallery") {
    renderGallerySlider(grid, filtered);
    return;
  }

  renderNormalSlider(grid, type, filtered);
}

/* =====================================
   HOMEPAGE HERO SLIDER
===================================== */

function renderHeroSlider(items) {
  const slider = $("heroMarketingSlider");
  if (!slider) return;

  const mediaItems = items.filter(item => {
    if (item.active !== true) return false;

    if (item.type === "videos") {
      return Boolean(safeURL(item.mediaUrl));
    }

    if (
      ["companyNews", "gallery", "printPress"].includes(item.type)
    ) {
      return Boolean(getImage(item));
    }

    return false;
  });

  slider.innerHTML = "";

  if (!mediaItems.length) return;

  let currentIndex = 0;
  let autoSlideTimer = null;

  const slides = [];


mediaItems.forEach((item, index) => {
  const slide = document.createElement("div");
  slide.className = "hero-marketing-slide";

  if (item.type === "videos") {
    const video = document.createElement("video");

    video.src = safeURL(item.mediaUrl);
    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = true;
    video.loop = false;
    video.controls = true;
    video.playsInline = true;
    video.preload = "auto";

    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = "cover";
    video.style.background = "#000";

    const poster = safeURL(item.thumbnailUrl);
    if (poster) {
      video.poster = poster;
    }

    video.addEventListener("error", () => {
      console.error("Hero video loading failed:", item.title, item.mediaUrl);

      if (slides[currentIndex] === slide) {
        clearTimeout(autoSlideTimer);
        autoSlideTimer = setTimeout(nextSlide, 5000);
      }
    });

    video.addEventListener("ended", () => {
      if (slides[currentIndex] === slide) {
        nextSlide();
      }
    });

    slide.appendChild(video);

  } else {
    const img = document.createElement("img");

    img.src = getImage(item);
    img.alt = item.title ||
      (marketingWebsiteMode === "customer"
        ? "Intello Electric"
        : "RB Tech Solution");

    img.loading = index === 0 ? "eager" : "lazy";

    slide.appendChild(img);
  }

  slider.appendChild(slide);
  slides.push(slide);
});


  const previous = document.createElement("button");
  previous.type = "button";
  previous.className =
    "hero-marketing-arrow hero-marketing-prev";
  previous.textContent = "‹";
  previous.setAttribute("aria-label", "Previous slide");

  const next = document.createElement("button");
  next.type = "button";
  next.className =
    "hero-marketing-arrow hero-marketing-next";
  next.textContent = "›";
  next.setAttribute("aria-label", "Next slide");

  const dots = document.createElement("div");
  dots.className = "hero-marketing-dots";

  const dotButtons = slides.map((slide, index) => {
    const dot = document.createElement("button");

    dot.type = "button";
    dot.className = "hero-marketing-dot";

    dot.setAttribute(
      "aria-label",
      "Go to slide " + (index + 1)
    );

    dot.addEventListener("click", () => showSlide(index));

    dots.appendChild(dot);
    return dot;
  });

  slider.append(previous, next, dots);

  function showSlide(index) {
    clearTimeout(autoSlideTimer);

    currentIndex =
      (index + slides.length) % slides.length;

    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === currentIndex);

      const video = slide.querySelector("video");

      if (!video) return;

      if (i === currentIndex) {
        video.currentTime = 0;

        video.play().catch(error => {
  console.error("Hero video play issue:", error);
});
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });

    dotButtons.forEach((dot, i) => {
      dot.classList.toggle("active", i === currentIndex);
    });

    const activeVideo =
      slides[currentIndex].querySelector("video");

    if (!activeVideo && slides.length > 1) {
      autoSlideTimer = setTimeout(nextSlide, 5000);
    }
  }

  function nextSlide() {
    showSlide(currentIndex + 1);
  }

  function previousSlide() {
    showSlide(currentIndex - 1);
  }

  previous.addEventListener("click", previousSlide);
  next.addEventListener("click", nextSlide);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(autoSlideTimer);

      const video =
        slides[currentIndex]?.querySelector("video");

      if (video) video.pause();
    } else {
      showSlide(currentIndex);
    }
  });

  showSlide(0);
}

/* =====================================
   CONVERT OLD RB PRODUCTS TO GALLERY
===================================== */

function convertOldProductToGallery(product) {
  const image = safeURL(
    product.imageUrl ||
    product.image ||
    product.photo
  );

  if (!image) return null;

  return {
    id: "website-product-" + product.id,
    type: "gallery",
    active: true,

    title:
      product.name ||
      product.productName ||
      product.title ||
      "Security Product",

    description: product.description || "",
    mediaUrl: image,
    publicId: product.publicId || "",
    productSource: "website",
    productId: product.id,
    createdAt: product.createdAt || null
  };
}

/* =====================================
   CONVERT CUSTOMER PRODUCTS TO GALLERY
===================================== */

function convertCustomerProductToGallery(product) {
  const image = safeURL(
    product.imageUrl ||
    product.image ||
    product.photo
  );

  if (!image) return null;

  return {
    id: "customer-product-" + product.id,
    type: "gallery",
    active: true,

    title:
      product.name ||
      product.productName ||
      product.title ||
      "Product",

    description: product.description || "",
    mediaUrl: image,
    publicId: product.publicId || "",
    productSource: "customer",
    productId: product.id,
    customerId: product.customerId || "",
    createdAt: product.createdAt || null
  };
}


/* =====================================
   RESOLVE CURRENT WEBSITE TENANT
   PUBLIC DOMAIN MAPPING
===================================== */

async function resolveMarketingTenant() {
  const hostname = location.hostname
    .toLowerCase()
    .replace(/^www\./, "");

  const pathname = location.pathname.toLowerCase();

  marketingTenantId = "";
  marketingTenantUid = "";
  marketingWebsiteMode = "blocked";

  // RB Tech पुरानी वेबसाइट
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
    marketingWebsiteMode = "legacy";
    marketingTenantId = "customer1";

    console.log("Marketing tenant: RB Tech Solution");
    return true;
  }

  // दूसरे domains के लिए publicWebsites mapping
  try {
    const websiteRef = doc(
      db,
      "publicWebsites",
      hostname
    );

    const websiteSnap = await getDoc(websiteRef);

    if (!websiteSnap.exists()) {
      console.error("Website mapping not found:", hostname);
      return false;
    }

    const websiteData = websiteSnap.data();

    if (websiteData.active !== true) {
      console.error("Website mapping inactive:", hostname);
      return false;
    }

    const mappedDomain = String(
      websiteData.domain || hostname
    )
      .toLowerCase()
      .replace(/^www\./, "");

    if (mappedDomain !== hostname) {
      console.error("Domain mismatch:", hostname);
      return false;
    }

    if (
      typeof websiteData.customerId !== "string" ||
      !websiteData.customerId.trim()
    ) {
      console.error("Customer ID missing in public mapping");
      return false;
    }

    marketingTenantId = websiteData.customerId;
    marketingWebsiteMode = "customer";

    console.log("Marketing tenant:", marketingTenantId);

    return true;

  } catch (error) {
    console.error("Domain mapping error:", error);
    return false;
  }
}

/* =====================================
   LOAD TENANT-SPECIFIC DATA
===================================== */

async function loadMarketingContent() {
  const allGrids = Object.values(SECTION_CONFIG)
    .map(config => $(config.grid))
    .filter(Boolean);

  const heroSlider = $("heroMarketingSlider");

  if (!allGrids.length && !heroSlider) return;

  try {
    const tenantResolved = await resolveMarketingTenant();

    if (!tenantResolved) {
      allGrids.forEach(grid => {
        grid.innerHTML = "";
      });

      if (heroSlider) heroSlider.innerHTML = "";

      console.error(
        "Website blocked: tenant could not be verified."
      );

      return;
    }

    let marketingItems = [];
    let oldProducts = [];
    let customerProducts = [];

    /* =====================================
       RB TECH SOLUTION - LEGACY WEBSITE
       customerId = customer1
    ===================================== */

    if (marketingWebsiteMode === "legacy") {
      const results = await Promise.allSettled([
        getDocs(
          query(
            collection(db, MARKETING_COLLECTION),
            where("customerId", "==", "customer1"),
            where("active", "==", true)
          )
        ),

        // यह पुरानी products collection केवल RB Tech साइट पर लोड होती है
        getDocs(
          query(
            collection(db, "products"),
            where("active", "==", true)
          )
        ),

        getDocs(
          query(
            collection(db, "customerProducts"),
            where("customerId", "==", "customer1"),
            where("active", "==", true)
          )
        )
      ]);

      if (results[0].status === "fulfilled") {
        marketingItems = results[0].value.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
      } else {
        console.error("RB marketing error:", results[0].reason);
      }

      if (results[1].status === "fulfilled") {
        oldProducts = results[1].value.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
      } else {
        console.error("RB old products error:", results[1].reason);
      }

      if (results[2].status === "fulfilled") {
        customerProducts = results[2].value.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
      } else {
        console.error("RB customer products error:", results[2].reason);
      }
    }

    /* =====================================
       INTELLO / OTHER CUSTOMER WEBSITE
       Only current customer ID
    ===================================== */

    else if (marketingWebsiteMode === "customer") {
      const results = await Promise.allSettled([
        getDocs(
          query(
            collection(db, MARKETING_COLLECTION),
            where("customerId", "==", marketingTenantId),
            where("active", "==", true)
          )
        ),

        getDocs(
          query(
            collection(db, "customerProducts"),
            where("customerId", "==", marketingTenantId),
            where("active", "==", true)
          )
        )
      ]);

      if (results[0].status === "fulfilled") {
        marketingItems = results[0].value.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
      } else {
        console.error(
          "Customer marketing error:",
          results[0].reason
        );
      }

      if (results[1].status === "fulfilled") {
        customerProducts = results[1].value.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
      } else {
        console.error(
          "Customer products error:",
          results[1].reason
        );
      }

      // Customer website पर RB Tech के पुराने products नहीं लाएँ
      oldProducts = [];
    }

    /* =====================================
       CONVERT PRODUCTS TO GALLERY
    ===================================== */

    const oldProductGallery = oldProducts
      .map(convertOldProductToGallery)
      .filter(Boolean);

    const customerProductGallery = customerProducts
      .map(convertCustomerProductToGallery)
      .filter(Boolean);

    const allMarketingItems = [
      ...marketingItems,
      ...oldProductGallery,
      ...customerProductGallery
    ];

    /* =====================================
       HERO SLIDER
    ===================================== */

    renderHeroSlider(allMarketingItems);

    /* =====================================
       RENDER ALL SECTIONS
    ===================================== */

    Object.keys(SECTION_CONFIG).forEach(type => {
      renderSection(type, allMarketingItems);
    });

    /* =====================================
       DEBUG INFORMATION
    ===================================== */

    console.log("Website mode:", marketingWebsiteMode);
    console.log("Tenant ID:", marketingTenantId);
    console.log("Marketing items:", marketingItems.length);
    console.log("Old products:", oldProducts.length);
    console.log("Customer products:", customerProducts.length);
    console.log("Old product gallery:", oldProductGallery.length);
    console.log("Customer product gallery:", customerProductGallery.length);

    const finalGallery = getUniqueGalleryItems(
      allMarketingItems.filter(item =>
        item.type === "gallery" &&
        item.active === true
      )
    );

    console.log(
      "Final unique Gallery photos:",
      finalGallery.length
    );

  } catch (error) {
    console.error("Marketing loading error:", error);

    allGrids.forEach(grid => {
      grid.innerHTML =
        "<p>Unable to load content. Please try again later.</p>";
    });
  }
}

/* =====================================
   VIEWER CLOSE EVENTS
===================================== */

$("closeMarketingViewer")?.addEventListener(
  "click",
  closeMarketingViewer
);

$("marketingViewer")?.addEventListener(
  "click",
  event => {
    if (event.target.id === "marketingViewer") {
      closeMarketingViewer();
    }
  }
);

document.addEventListener("keydown", event => {
  if (
    event.key === "Escape" &&
    $("marketingViewer")?.classList.contains("active")
  ) {
    closeMarketingViewer();
  }
});

/* =====================================
   START
===================================== */

loadMarketingContent();
