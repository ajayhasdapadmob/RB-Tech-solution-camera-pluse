
import { db } from "./firebase.js";

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
  const date = escapeHTML(formatDate(item.createdAt));

  const card = document.createElement("article");
  card.className = "marketing-item";

  let mediaHTML = "";

  if (type === "videos") {
    mediaHTML = image
      ? `<img src="${escapeHTML(image)}" alt="${title}" loading="lazy">`
      : `<div style="height:190px;display:grid;place-items:center;background:#edf5ee;font-size:42px">▶</div>`;
  } else if (image) {
    mediaHTML = `<img src="${escapeHTML(image)}" alt="${title}" loading="lazy">`;
  }

  let actionHTML = "";

  if (type === "brochures") {
    const fileURL = safeURL(item.mediaUrl);

    actionHTML = fileURL
      ? `<a href="${escapeHTML(fileURL)}" target="_blank" rel="noopener">View / Download PDF</a>`
      : "";
  } else if (type === "videos") {
    actionHTML = `<button type="button" data-action="video">▶ Watch Video</button>`;
  } else if (type === "gallery") {
    actionHTML = `<button type="button" data-action="image">View Photo</button>`;
  } else {
    actionHTML = `<button type="button" data-action="article">Read More</button>`;
  }

  card.innerHTML = `
    ${mediaHTML}
    <div class="marketing-item-body">
      <h3>${title}</h3>
      ${date ? `<small>${date}</small>` : ""}
      ${description
        ? `<p>${description.length > 160
            ? description.slice(0, 160) + "..."
            : description}</p>`
        : ""}
      ${actionHTML}
    </div>
  `;

  const action = card.querySelector("[data-action]");

  action?.addEventListener("click", () => {
    if (type === "videos") showVideo(item);
    else if (type === "gallery") showImage(item);
    else showArticle(item);
  });

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

  if (!filtered.length) {
    grid.innerHTML = `<p>${config.empty}</p>`;
    return;
  }

  filtered.forEach(item => {
    grid.appendChild(createCard(item, type));
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
