
import { db } from "./firebase.js";

console.log("RB Marketing JS Loaded Successfully");

import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* =====================================
   RB TECH SOLUTION - PUBLIC MARKETING
   Company News / Brochures / Videos
   Gallery / Print & Press
   Product Photos + Duplicate Protection
===================================== */

const MARKETING_COLLECTION = "marketingItems";

const SECTION_CONFIG = {
  companyNews: {
    grid: "companyNewsGrid"
  },
  brochures: {
    grid: "brochuresGrid"
  },
  videos: {
    grid: "videosGrid"
  },
  gallery: {
    grid: "galleryGrid"
  },
  printPress: {
    grid: "printPressGrid"
  }
};

const $ = (id) => document.getElementById(id);

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
   GALLERY DUPLICATE IMAGE PROTECTION
===================================== */

function getGalleryImageKey(item) {

  const publicId = String(
    item?.publicId || ""
  ).trim();

  // Same Cloudinary public ID = same image
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

    // Ignore query parameters when comparing image URLs.
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

    if (!key) return;

    if (seen.has(key)) return;

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
   SHOW NEWS / ARTICLE
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
      style="background:#000">

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

  // Video autoplay
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

  // Clickable image cursor
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
   RENDER MARKETING SECTION
===================================== */

function renderSection(type, items) {

  const config = SECTION_CONFIG[type];

  if (!config) return;

  const grid = $(config.grid);

  if (!grid) return;

  grid.innerHTML = "";

  let filtered = items.filter(item =>
    item.type === type &&
    item.active === true
  );

  // Newest first
  filtered.sort((a, b) => {

    const aTime = a.createdAt?.toMillis
      ? a.createdAt.toMillis()
      : new Date(a.createdAt || 0).getTime();

    const bTime = b.createdAt?.toMillis
      ? b.createdAt.toMillis()
      : new Date(b.createdAt || 0).getTime();

    return bTime - aTime;

  });

  if (!filtered.length) return;

 
  /* =====================================
     GALLERY: AUTO SLIDER
     Manual Gallery + Product Photos
     Duplicate Protection
  ===================================== */

  if (type === "gallery") {

    const uniqueGallery = getUniqueGalleryItems(filtered);

    if (!uniqueGallery.length) return;

    // Slider wrapper
    const gallerySlider = document.createElement("div");

    gallerySlider.className = "marketing-gallery-slider";

    gallerySlider.style.position = "relative";
    gallerySlider.style.width = "100%";

    // Viewport
    const viewport = document.createElement("div");

    viewport.className = "marketing-gallery-viewport";

    viewport.style.width = "100%";
    viewport.style.overflow = "hidden";

    // Track
    const track = document.createElement("div");

    track.className = "marketing-gallery-track";

    track.style.display = "flex";
    track.style.gap = "20px";
    track.style.width = "max-content";
    track.style.transition = "transform 0.6s ease";
    track.style.willChange = "transform";

    viewport.appendChild(track);
    gallerySlider.appendChild(viewport);

    grid.appendChild(gallerySlider);

    // Create original cards
    const originalCards = uniqueGallery.map((item, index) => {

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
    let galleryTimer = null;

    const gap = 20;

    // Previous button
    const left = document.createElement("button");

    left.type = "button";
    left.className = "marketing-arrow marketing-left";
    left.textContent = "❮";
    left.setAttribute("aria-label", "Previous photo");

    // Next button
    const right = document.createElement("button");

    right.type = "button";
    right.className = "marketing-arrow marketing-right";
    right.textContent = "❯";
    right.setAttribute("aria-label", "Next photo");

    // Arrow styling
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
      button.style.color = "#ffffff";
      button.style.fontSize = "22px";
      button.style.cursor = "pointer";

    });

    left.style.left = "10px";
    right.style.right = "10px";

    gallerySlider.append(left, right);

    // Rebuild slider for screen size
    function rebuildGallery() {

      stopGalleryAuto();

      const width = viewport.clientWidth;

      if (!width) return;

      if (window.innerWidth <= 480) {

        visibleCount = 1;

      } else if (window.innerWidth <= 768) {

        visibleCount = 2;

      } else {

        visibleCount = 3;

      }

      visibleCount = Math.min(
        visibleCount,
        originalCards.length
      );

      position = 0;

      track.style.transition = "none";
      track.replaceChildren(...originalCards);

      const cardWidth =
        (width - gap * (visibleCount - 1)) / visibleCount;

      originalCards.forEach(card => {

        card.style.flex = `0 0 ${cardWidth}px`;
        card.style.width = `${cardWidth}px`;

      });

      // Clone first cards for continuous forward sliding
      if (originalCards.length > visibleCount) {

        originalCards
          .slice(0, visibleCount)
          .forEach(card => {

            const clone = card.cloneNode(true);

            clone.setAttribute("aria-hidden", "true");

            clone.dataset.galleryClone = "true";

            track.appendChild(clone);

          });

      }

      track.style.transform = "translate3d(0,0,0)";

      // Restore transition after resetting
      requestAnimationFrame(() => {

        track.style.transition = "transform 0.6s ease";

      });

      // Hide arrows if not enough photos
      const canMove = originalCards.length > visibleCount;

      left.style.display = canMove ? "block" : "none";
      right.style.display = canMove ? "block" : "none";

      startGalleryAuto();

    }

    // Move slider
    function moveGallery(direction) {

      if (originalCards.length <= visibleCount) return;

      const total = originalCards.length;

      if (direction > 0) {

        position++;

        if (position > total) {
          position = 1;
          track.style.transition = "none";
          track.style.transform = "translate3d(0,0,0)";

          requestAnimationFrame(() => {

            track.style.transition = "transform 0.6s ease";

            track.style.transform =
              `translate3d(-${position * (originalCards[0].offsetWidth + gap)}px,0,0)`;

          });

          return;
        }

      } else {

        position = (position - 1 + total) % total;

      }

      track.style.transform =
        `translate3d(-${position * (originalCards[0].offsetWidth + gap)}px,0,0)`;

    }

    // Automatic slide
    function startGalleryAuto() {

      stopGalleryAuto();

      if (originalCards.length <= visibleCount) return;

      galleryTimer = setInterval(() => {

        moveGallery(1);

      }, 3000);

    }

    function stopGalleryAuto() {

      if (galleryTimer) {

        clearInterval(galleryTimer);

        galleryTimer = null;

      }

    }

    // Arrow events
    left.addEventListener("click", () => {
      moveGallery(-1);
    });

    right.addEventListener("click", () => {
      moveGallery(1);
    });

    // Pause on hover
    gallerySlider.addEventListener("mouseenter", stopGalleryAuto);

    gallerySlider.addEventListener("mouseleave", startGalleryAuto);

    // Open image viewer
    track.addEventListener("click", event => {

      if (event.target.closest("a, button")) return;

      const card = event.target.closest(".marketing-item");

      if (!card) return;

      const index = Number(card.dataset.marketingIndex);

      const item = uniqueGallery[index];

      if (item) {
        showImage(item);
      }

    });

    // Responsive adjustment
    let resizeTimer = null;

    window.addEventListener("resize", () => {

      clearTimeout(resizeTimer);

      resizeTimer = setTimeout(() => {

        rebuildGallery();

      }, 200);

    });

    // Start after layout
    requestAnimationFrame(() => {

      rebuildGallery();

    });

    console.log(
      "Gallery slider initialized:",
      uniqueGallery.length,
      "unique photos"
    );

    return;

  }

  /* =====================================
     OTHER SECTIONS: ORIGINAL SLIDER
  ===================================== */

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

  /* Fill first group */

  function fillGroup(group) {

    let index = 0;

    const targetWidth = viewport.clientWidth + 300;

    while (
      group.scrollWidth < targetWidth ||
      group.children.length === 0
    ) {

      group.appendChild(
        createCard(
          filtered[index % filtered.length],
          type,
          index % filtered.length
        )
      );

      index++;

      if (index > 500) break;

    }

  }

  fillGroup(group1);

  /* Duplicate group for continuous slider */

  const group2 = group1.cloneNode(true);

  group2.setAttribute("aria-hidden", "true");

  track.appendChild(group2);

  /* Play all videos */

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

  playAllVideos();

  /* Slider arrows */

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

  /* Slider movement */

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
      `translate3d(${position}px, 0, 0)`;

  }

  function animate(timestamp) {

    if (paused || !groupWidth) {

      frameId = null;

      return;

    }

    if (!lastTime) {
      lastTime = timestamp;
    }

    const elapsed = Math.min(
      timestamp - lastTime,
      50
    );

    lastTime = timestamp;

    position += speed * elapsed / 1000;

    if (position >= 0) {
      position -= groupWidth;
    }

    track.style.transform =
      `translate3d(${position}px, 0, 0)`;

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

    if (position >= 0) {
      position -= groupWidth;
    }

    if (position < -groupWidth) {
      position += groupWidth;
    }

    track.style.transform =
      `translate3d(${position}px, 0, 0)`;

  }

  left.addEventListener("click", () => {
    moveCard(1);
  });

  right.addEventListener("click", () => {
    moveCard(-1);
  });

  /* Image click support */

  track.addEventListener("click", event => {

    const card = event.target.closest(".marketing-item");

    if (!card) return;

    const clickedImage = event.target.closest("img");

    if (!clickedImage) return;

    const cardType = card.dataset.marketingType;

    const itemIndex = Number(
      card.dataset.marketingIndex
    );

    const item = filtered[itemIndex];

    if (!item) return;

    if (cardType === "companyNews") {
      showArticle(item);
    }

    if (cardType === "printPress") {
      showArticle(item);
    }

  });

  /* Start slider after layout calculation */

  requestAnimationFrame(() => {

    measureSlider();

    playAllVideos();

    startSlider();

  });

  /* Responsive slider */

  window.addEventListener("resize", () => {

    stopSlider();

    measureSlider();

    playAllVideos();

    startSlider();

  });

}

/* =====================================
   HOMEPAGE HERO MARKETING SLIDER
   VIDEO + IMAGE AUTO SLIDER
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

  if (!mediaItems.length) {

    slider.innerHTML = "";

    return;

  }

  slider.innerHTML = "";

  let currentIndex = 0;

  let autoSlideTimer = null;

  const slides = [];

  // CREATE SLIDES
  mediaItems.forEach((item, index) => {

    const slide = document.createElement("div");

    slide.className = "hero-marketing-slide";

    if (item.type === "videos") {

      const video = document.createElement("video");

      video.src = safeURL(item.mediaUrl);

      video.autoplay = false;

      video.muted = true;

      video.loop = false;

      video.controls = false;

      video.playsInline = true;

      video.preload = "auto";

      video.setAttribute("muted", "");

      video.setAttribute("playsinline", "");

      video.setAttribute("webkit-playsinline", "");

      const poster = safeURL(item.thumbnailUrl);

      if (poster) {
        video.poster = poster;
      }

      video.addEventListener("ended", () => {

        if (slides[currentIndex] === slide) {
          nextSlide();
        }

      });

      video.addEventListener("error", () => {

        console.error(
          "Hero video loading error:",
          video.src,
          video.error
        );

        if (slides[currentIndex] === slide) {

          clearTimeout(autoSlideTimer);

          autoSlideTimer = setTimeout(
            nextSlide,
            5000
          );

        }

      });

      slide.appendChild(video);

    } else {

      const img = document.createElement("img");

      img.src = getImage(item);

      img.alt = item.title || "RB Tech Solution";

      img.loading = index === 0 ? "eager" : "lazy";

      img.onerror = () => {

        console.error(
          "Hero image loading failed:",
          img.src
        );

      };

      slide.appendChild(img);

    }

    slider.appendChild(slide);

    slides.push(slide);

  });

  // PREVIOUS BUTTON
  const previous = document.createElement("button");

  previous.type = "button";

  previous.className =
    "hero-marketing-arrow hero-marketing-prev";

  previous.textContent = "‹";

  previous.setAttribute(
    "aria-label",
    "Previous slide"
  );

  // NEXT BUTTON
  const next = document.createElement("button");

  next.type = "button";

  next.className =
    "hero-marketing-arrow hero-marketing-next";

  next.textContent = "›";

  next.setAttribute(
    "aria-label",
    "Next slide"
  );

  // DOTS
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

    dot.addEventListener("click", () => {
      showSlide(index);
    });

    dots.appendChild(dot);

    return dot;

  });

  slider.append(previous, next, dots);

  // SHOW SLIDE
  function showSlide(index) {

    clearTimeout(autoSlideTimer);

    currentIndex =
      (index + slides.length) % slides.length;

    slides.forEach((slide, i) => {

      slide.classList.toggle(
        "active",
        i === currentIndex
      );

      const video = slide.querySelector("video");

      if (video) {

        if (i === currentIndex) {

          video.currentTime = 0;

          video.play().then(() => {

            console.log(
              "Hero video playing:",
              video.src
            );

          }).catch(error => {

            console.error(
              "Hero video play failed:",
              error
            );

            if (slides[currentIndex] === slide) {

              autoSlideTimer = setTimeout(
                nextSlide,
                5000
              );

            }

          });

        } else {

          video.pause();

          video.currentTime = 0;

        }

      }

    });

    dotButtons.forEach((dot, i) => {

      dot.classList.toggle(
        "active",
        i === currentIndex
      );

    });

    // IMAGE: SHOW FOR 5 SECONDS
    const activeVideo =
      slides[currentIndex].querySelector("video");

    if (!activeVideo && slides.length > 1) {

      autoSlideTimer = setTimeout(
        nextSlide,
        5000
      );

    }

  }

  function nextSlide() {
    showSlide(currentIndex + 1);
  }

  function previousSlide() {
    showSlide(currentIndex - 1);
  }

  previous.addEventListener(
    "click",
    previousSlide
  );

  next.addEventListener(
    "click",
    nextSlide
  );

  // PAUSE WHEN TAB IS HIDDEN
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
   CONVERT OLD PRODUCTS TO GALLERY ITEMS
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
      "Security Product",

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
   LOAD MARKETING + PRODUCT GALLERY
===================================== */

async function loadMarketingContent() {

  const allGrids = Object.values(SECTION_CONFIG)
    .map(config => $(config.grid))
    .filter(Boolean);

  const heroSlider = $("heroMarketingSlider");

  if (!allGrids.length && !heroSlider) return;

  try {

    const results = await Promise.allSettled([

      // Marketing Admin content
      getDocs(
        query(
          collection(db, MARKETING_COLLECTION),
          where("active", "==", true)
        )
      ),

      // Old website products
      getDocs(
        query(
          collection(db, "products"),
          where("active", "==", true)
        )
      ),

      // Customer Admin products
      getDocs(
        query(
          collection(db, "customerProducts"),
          where("active", "==", true)
        )
      )

    ]);

    /* =====================================
       MARKETING ITEMS
    ===================================== */

    let marketingItems = [];

    if (results[0].status === "fulfilled") {

      marketingItems = results[0].value.docs.map(document => ({

        id: document.id,

        ...document.data()

      }));

    } else {

      console.error(
        "Marketing loading error:",
        results[0].reason
      );

    }

    /* =====================================
       OLD WEBSITE PRODUCTS
    ===================================== */

    let oldProducts = [];

    if (results[1].status === "fulfilled") {

      oldProducts = results[1].value.docs.map(document => ({

        id: document.id,

        ...document.data()

      }));

    } else {

      console.error(
        "Old products loading error:",
        results[1].reason
      );

    }

    /* =====================================
       CUSTOMER ADMIN PRODUCTS
    ===================================== */

    let customerProducts = [];

    if (results[2].status === "fulfilled") {

      customerProducts = results[2].value.docs.map(document => ({

        id: document.id,

        ...document.data()

      }));

    } else {

      console.error(
        "Customer products loading error:",
        results[2].reason
      );

    }

    /* =====================================
       CONVERT PRODUCTS TO GALLERY ITEMS
    ===================================== */

    const oldProductGallery = oldProducts
      .map(convertOldProductToGallery)
      .filter(Boolean);

    const customerProductGallery = customerProducts
      .map(convertCustomerProductToGallery)
      .filter(Boolean);

    const productGalleryItems = [

      ...oldProductGallery,

      ...customerProductGallery

    ];

    /* =====================================
       COMBINE MARKETING + PRODUCT GALLERY
    ===================================== */

    const allMarketingItems = [

      ...marketingItems,

      ...productGalleryItems

    ];

    /* =====================================
       HOMEPAGE HERO
       Original marketing content only
    ===================================== */

    renderHeroSlider(marketingItems);

    /* =====================================
       RENDER ALL MARKETING SECTIONS
    ===================================== */

    Object.keys(SECTION_CONFIG).forEach(type => {

      renderSection(
        type,
        allMarketingItems
      );

    });

    /* =====================================
       DEBUG INFORMATION
    ===================================== */

    console.log(
      "Marketing items:",
      marketingItems.length
    );

    console.log(
      "Old website products:",
      oldProducts.length
    );

    console.log(
      "Customer Admin products:",
      customerProducts.length
    );

    console.log(
      "Old product Gallery photos:",
      oldProductGallery.length
    );

    console.log(
      "Customer product Gallery photos:",
      customerProductGallery.length
    );

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

    console.error(
      "Marketing and Gallery loading error:",
      error
    );

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
   LOAD PUBLIC MARKETING DATA
===================================== */

loadMarketingContent();
