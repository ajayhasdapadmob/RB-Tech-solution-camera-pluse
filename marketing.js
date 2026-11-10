

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
    grid: "companyNewsGrid",
    empty: "No company news available."
  },
  brochures: {
    grid: "brochuresGrid",
    empty: "No product brochures available."
  },
  videos: {
    grid: "videosGrid",
    empty: "No videos available."
  },
  gallery: {
    grid: "galleryGrid",
    empty: "No gallery photos available."
  },
  printPress: {
    grid: "printPressGrid",
    empty: "No Print & Press content available."
  }
};

const $ = (id) => document.getElementById(id);

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
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
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

function getViewerElements() {
  return {
    viewer: $("marketingViewer"),
    content: $("marketingViewerContent"),
    close: $("closeMarketingViewer")
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

function showArticle(item) {
  const title = escapeHTML(item.title || "Untitled");
  const description = escapeHTML(getText(item));
  const date = escapeHTML(formatDate(item.createdAt));
  const image = getImage(item);

  openMarketingViewer(`
    ${image ? `<img src="${escapeHTML(image)}" alt="${title}">` : ""}
    <h2>${title}</h2>
    ${date ? `<p>${date}</p>` : ""}
    <div style="text-align:left;line-height:1.8;white-space:pre-line">
      ${description}
    </div>
  `);
}

function showImage(item) {
  const image = safeURL(item.mediaUrl || item.thumbnailUrl);
  if (!image) return;

  openMarketingViewer(`
    <img src="${escapeHTML(image)}"
         alt="${escapeHTML(item.title || "Gallery image")}">
    ${item.title
      ? `<h2>${escapeHTML(item.title)}</h2>`
      : ""}
    ${getText(item)
      ? `<p>${escapeHTML(getText(item))}</p>`
      : ""}
  `);
}

function showVideo(item) {
  const video = safeURL(item.mediaUrl);
  if (!video) return;

  const title = escapeHTML(item.title || "Video");

  openMarketingViewer(`
    <h2>${title}</h2>
    <video controls autoplay playsinline
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


function createCard(item, type) {
  const title = escapeHTML(item.title || "Untitled");
  const description = escapeHTML(getText(item));
  const image = getImage(item);

  const card = document.createElement("article");
  card.className = "marketing-item";

  let mediaHTML = "";

  if (type === "videos") {
    const videoURL = safeURL(item.mediaUrl);

    mediaHTML = videoURL
      ? `<video
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
         </video>`
      : `<div style="height:190px;display:grid;place-items:center;background:#edf5ee">
           Video unavailable
         </div>`;
  } else if (image) {
    mediaHTML = `
      <img src="${escapeHTML(image)}"
           alt="${title}"
           loading="lazy">
    `;
  }

  let actionHTML = "";

  if (type === "brochures") {
    const fileURL = safeURL(item.mediaUrl);

    actionHTML = fileURL
      ? `<a href="${escapeHTML(fileURL)}"
            target="_blank"
            rel="noopener">View / Download PDF</a>`
      : "";
  }

  card.innerHTML = `
    ${mediaHTML}
    <div class="marketing-item-body">
      <h3>${title}</h3>

      ${type !== "videos" && description
        ? `<p>${description.length > 160
            ? description.slice(0, 160) + "..."
            : description}</p>`
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

  if (type === "gallery") {
    const photo = card.querySelector("img");

    photo?.addEventListener("click", () => showImage(item));

    if (photo) photo.style.cursor = "pointer";
  }

  if (type === "companyNews" || type === "printPress") {
    const photo = card.querySelector("img");

    photo?.addEventListener("click", () => showArticle(item));

    if (photo) photo.style.cursor = "pointer";
  }

  return card;
}





function renderSection(type, items) {
  const config = SECTION_CONFIG[type];
  const grid = $(config.grid);

  if (!grid) return;

  grid.innerHTML = "";

  const filtered = items
    .filter(item => item.type === type && item.active === true)
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

  // IMPORTANT: Group ko DOM mein attach karne ke baad cards add karein
  track.appendChild(group1);

  function fillGroup(group) {
    let index = 0;

    const targetWidth = viewport.clientWidth + 300;

    while (
      group.scrollWidth < targetWidth ||
      group.children.length === 0
    ) {
      group.appendChild(
        createCard(filtered[index % filtered.length], type)
      );

      index++;

      if (index > 500) break;
    }
  }

  fillGroup(group1);

  // Duplicate group for seamless sliding
  const group2 = group1.cloneNode(true);
  group2.setAttribute("aria-hidden", "true");

  track.appendChild(group2);

  // Play every video in both groups
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
      `translate3d(${position}px, 0, 0)`;
  }

  function animate(timestamp) {
    if (paused || !groupWidth) {
      frameId = null;
      return;
    }

    if (!lastTime) lastTime = timestamp;

    const elapsed = Math.min(timestamp - lastTime, 50);
    lastTime = timestamp;

    // Continuous left-to-right movement
    position += speed * elapsed / 1000;

    // Seamless reset after complete group movement
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

    if (position >= 0) position -= groupWidth;

    if (position < -groupWidth) position += groupWidth;

    track.style.transform =
      `translate3d(${position}px, 0, 0)`;
  }

  left.addEventListener("click", () => moveCard(1));
  right.addEventListener("click", () => moveCard(-1));

  // Start after browser calculates the actual group width
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

/* Viewer close events */
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

/* Load public marketing data */
loadMarketingContent();
