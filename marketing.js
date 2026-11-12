
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
  return safeURL(item.thumbnailUrl || item.mediaUrl);
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
  const image = safeURL(item.mediaUrl || item.thumbnailUrl);

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

  // Image click ke liye data save
  card.dataset.marketingIndex = index;
  card.dataset.marketingType = type;

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

  // Gallery / News images clickable
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
   RENDER MARKETING SECTION SLIDER
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

    const elapsed = Math.min(timestamp - lastTime, 50);

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

  /* Image click support for original and duplicate cards */

  track.addEventListener("click", event => {
    const card = event.target.closest(".marketing-item");

    if (!card) return;

    const clickedImage = event.target.closest("img");

    if (!clickedImage) return;

    const cardType = card.dataset.marketingType;

    const itemIndex = Number(card.dataset.marketingIndex);

    const item = filtered[itemIndex];

    if (!item) return;

    if (cardType === "gallery") {
      showImage(item);
    }

    if (
      cardType === "companyNews" ||
      cardType === "printPress"
    ) {
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

    if (["companyNews", "gallery", "printPress"].includes(item.type)) {
      return Boolean(getImage(item));
    }

    return false;
  });

  if (!mediaItems.length) return;

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
      if (poster) video.poster = poster;

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
          autoSlideTimer = setTimeout(nextSlide, 5000);
        }
      });

      slide.appendChild(video);

    } else {
      const img = document.createElement("img");

      img.src = getImage(item);
      img.alt = item.title || "RB Tech Solution";
      img.loading = index === 0 ? "eager" : "lazy";

      img.onerror = () => {
        console.error("Hero image loading failed:", img.src);
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
  previous.setAttribute("aria-label", "Previous slide");

  // NEXT BUTTON
  const next = document.createElement("button");
  next.type = "button";
  next.className =
    "hero-marketing-arrow hero-marketing-next";
  next.textContent = "›";
  next.setAttribute("aria-label", "Next slide");

  // DOTS
  const dots = document.createElement("div");
  dots.className = "hero-marketing-dots";

  const dotButtons = slides.map((slide, index) => {
    const dot = document.createElement("button");

    dot.type = "button";
    dot.className = "hero-marketing-dot";
    dot.setAttribute("aria-label", "Go to slide " + (index + 1));

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

    currentIndex = (index + slides.length) % slides.length;

    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === currentIndex);

      const video = slide.querySelector("video");

      if (video) {
        if (i === currentIndex) {
          video.currentTime = 0;

          video.play().then(() => {
            console.log("Hero video playing:", video.src);
          }).catch(error => {
            console.error("Hero video play failed:", error);

            if (slides[currentIndex] === slide) {
              autoSlideTimer = setTimeout(nextSlide, 5000);
            }
          });

        } else {
          video.pause();
          video.currentTime = 0;
        }
      }
    });

    dotButtons.forEach((dot, i) => {
      dot.classList.toggle("active", i === currentIndex);
    });

    // IMAGE: SHOW FOR 5 SECONDS
    const activeVideo = slides[currentIndex].querySelector("video");

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

  // PAUSE WHEN TAB IS HIDDEN
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(autoSlideTimer);

      const video = slides[currentIndex]?.querySelector("video");
      if (video) video.pause();

    } else {
      showSlide(currentIndex);
    }
  });

  showSlide(0);
}


/* =====================================
   LOAD MARKETING CONTENT FROM FIRESTORE
===================================== */

async function loadMarketingContent() {
  const allGrids = Object.values(SECTION_CONFIG)
    .map(config => $(config.grid))
    .filter(Boolean);

  if (!allGrids.length) return;

  try {
    const marketingQuery = query(
      collection(db, MARKETING_COLLECTION),
      where("active", "==", true)
    );

    const snapshot = await getDocs(marketingQuery);

    const items = snapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
    }));

    // Homepage hero slider
    renderHeroSlider(items);

    // All marketing sliders
    Object.keys(SECTION_CONFIG).forEach(type => {
      renderSection(type, items);
    });

  } catch (error) {
    console.error("Marketing content error:", error);

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

$("marketingViewer")?.addEventListener("click", event => {
  if (event.target.id === "marketingViewer") {
    closeMarketingViewer();
  }
});

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
