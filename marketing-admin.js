
import { auth, db } from "./firebase.js";

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* ==========================================
   RB TECH SOLUTION - CUSTOMER MARKETING ADMIN
   Company News
   Product Brochures
   Videos
   Gallery
   Print & Press
========================================== */

const CLOUDINARY_NAME = "ch5mab4a";
const CLOUDINARY_PRESET = "rbtech_products";
const CLOUDINARY_FOLDER = "rb-tech-solution/marketing";


const MARKETING_TYPES = {
  companyNews: {
    title: "Company News",
    accept: "image/jpeg,image/png,image/webp",
    resource: "image",
    multiple: true
  },

  brochures: {
    title: "Product Brochures",
    accept: "application/pdf",
    resource: "raw",
    multiple: true
  },

  videos: {
    title: "Videos",
    accept: "video/mp4,video/webm,video/quicktime",
    resource: "video",
    multiple: true
  },

  gallery: {
    title: "Gallery",
    accept: "image/jpeg,image/png,image/webp",
    resource: "image",
    multiple: true
  },

  printPress: {
    title: "Print & Press",
    accept: "image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm",
    resource: "auto",
    multiple: true
  }
};


let marketingCustomer = null;
let marketingContainer = null;
let editingMarketingId = null;
let marketingItems = [];
let marketingType = "companyNews";

const marketingCollection = () =>
  collection(db, "marketingItems");

/* ==========================================
   ESCAPE HTML
========================================== */

function marketingEscape(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

/* ==========================================
   SAFE URL
========================================== */

function marketingSafeURL(value) {
  try {
    const url = new URL(String(value || ""));

    return ["https:", "http:"].includes(url.protocol)
      ? url.href
      : "";

  } catch {
    return "";
  }
}

/* ==========================================
   MESSAGE
========================================== */

function marketingMessage(message, type = "info") {
  const box = marketingContainer?.querySelector(
    "#marketingAdminMessage"
  );

  if (!box) {
    alert(message);
    return;
  }

  box.textContent = message;

  box.style.color =
    type === "error" ? "#dc2626" : "#087f3c";
}

/* ==========================================
   CURRENT CUSTOMER UID
========================================== */

function marketingCurrentUid() {
  return auth.currentUser?.uid || "";
}

/* ==========================================
   CUSTOMER VALIDATION
========================================== */

function marketingValidateCustomer() {
  if (!marketingCustomer?.id || !marketingCurrentUid()) {
    marketingMessage(
      "Customer information or login session is missing.",
      "error"
    );

    return false;
  }

  if (
    marketingCustomer.uid &&
    marketingCustomer.uid !== marketingCurrentUid()
  ) {
    marketingMessage(
      "Customer ownership verification failed.",
      "error"
    );

    return false;
  }

  return true;
}

/* ==========================================
   FILE RESOURCE TYPE
========================================== */

function marketingFileResource(type, file) {
  if (type === "printPress") {
    if (file.type.startsWith("image/")) {
      return "image";
    }

    if (file.type.startsWith("video/")) {
      return "video";
    }

    if (file.type === "application/pdf") {
      return "raw";
    }
  }

  return MARKETING_TYPES[type]?.resource || "image";
}

/* ==========================================
   FILE VALIDATION
========================================== */

function marketingValidateFile(type, file) {
  if (!file) {
    return "Please select a file.";
  }

  const maxSize = file.type.startsWith("video/")
    ? 100 * 1024 * 1024
    : 20 * 1024 * 1024;

  if (file.size > maxSize) {
    return file.type.startsWith("video/")
      ? "Video size must be below 100 MB."
      : "File size must be below 20 MB.";
  }

  const allowed =
    MARKETING_TYPES[type]?.accept?.split(",") || [];

  if (type === "printPress") {
    const valid =
      file.type.startsWith("image/") ||
      file.type.startsWith("video/") ||
      file.type === "application/pdf";

    if (!valid) {
      return "Only image, video and PDF files are allowed.";
    }

  } else if (!allowed.includes(file.type)) {
    return "Please select a supported file format.";
  }

  return "";
}

/* ==========================================
   CLOUDINARY UPLOAD
========================================== */

async function uploadMarketingFile(file, type) {
  const resource = marketingFileResource(type, file);

  const endpoint =
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_NAME}/${resource}/upload`;

  const formData = new FormData();

  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  formData.append("folder", CLOUDINARY_FOLDER);

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData
  });

  const result = await response.json();

  if (!response.ok || !result.secure_url) {
    throw new Error(
      result.error?.message ||
      "Cloudinary upload failed. Check your upload preset."
    );
  }

  return {
    url: result.secure_url,
    publicId: result.public_id || "",
    resourceType: result.resource_type || resource,
    format: result.format || "",
    fileName: file.name,
    bytes: file.size
  };
}

/* ==========================================
   MARKETING FORM HTML
========================================== */

function marketingFormHTML() {
  const config = MARKETING_TYPES[marketingType];

  const editingItem = editingMarketingId
    ? marketingItems.find(
        item => item.id === editingMarketingId
      )
    : null;

  return `
    <div class="card"
      style="padding:20px;margin-bottom:22px">

      <h3>${editingItem ? "Edit" : "Add"} ${config.title}</h3>

      <form id="marketingAdminForm">

        <label>Title *</label>

        <input
          id="marketingTitle"
          type="text"
          maxlength="150"
          required
          placeholder="Enter title"
          value="${marketingEscape(editingItem?.title || "")}"
          style="width:100%;padding:11px;margin:8px 0 15px;box-sizing:border-box"
        >

        <label>Description / Content</label>

        <textarea
          id="marketingDescription"
          rows="5"
          maxlength="10000"
          placeholder="Enter description or full content"
          style="width:100%;padding:11px;margin:8px 0 15px;box-sizing:border-box"
        >${marketingEscape(
          editingItem?.description ||
          editingItem?.content ||
          ""
        )}</textarea>

        <label>
          ${config.title} File
          ${editingItem ? "(Optional when editing)" : "*"}
        </label>

        <input
          id="marketingFile"
          type="file"
          accept="${config.accept}"
         ${config.multiple && !editingItem ? "multiple" : ""}
          ${editingItem ? "" : "required"}
          style="display:block;margin:10px 0 15px"
        >

        ${
          marketingType === "videos"
            ? `
              <label>Video Thumbnail (Optional)</label>

              <input
                id="marketingThumbnail"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style="display:block;margin:10px 0 15px"
              >
            `
            : ""
        }

        ${
          editingItem?.mediaUrl
            ? `
              <p style="font-size:13px;color:#087f3c">
                Existing file is saved. Select a new file only
                if you want to replace it.
              </p>
            `
            : ""
        }

        <label style="display:flex;align-items:center;gap:9px;margin:15px 0">

          <input
            id="marketingActive"
            type="checkbox"
            ${editingItem?.active !== false ? "checked" : ""}
          >

          Publish on Public Website

        </label>

        <button type="submit" id="saveMarketingBtn">
          ${editingItem ? "Update Content" : "Save Content"}
        </button>

        <button
          type="button"
          id="cancelMarketingEdit"
          style="margin-left:8px;background:#64748b"
        >
          Cancel
        </button>

        <p
          id="marketingUploadProgress"
          style="font-weight:600;margin-top:12px"
        ></p>

      </form>
    </div>
  `;
}

/* ==========================================
   MARKETING LIST HTML
========================================== */

function marketingListHTML() {
  const items = marketingItems.filter(
    item => item.type === marketingType
  );

  if (!items.length) {
    return "<p>No content added in this section yet.</p>";
  }

  return `
    <div style="
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(230px,1fr));
      gap:16px
    ">

      ${items.map(item => {
        const title = marketingEscape(item.title);

        const description = marketingEscape(
          item.description || item.content || ""
        );

        const image = marketingSafeURL(
          item.thumbnailUrl || item.mediaUrl
        );

        return `
          <article class="card"
            style="padding:15px;overflow:hidden">

            ${
              image && item.resourceType !== "raw"
                ? `
                  <img
                    src="${marketingEscape(image)}"
                    alt="${title}"
                    style="width:100%;height:160px;object-fit:cover;border-radius:7px"
                  >
                `
                : `
                  <div style="
                    height:100px;
                    background:#e8f2eb;
                    display:grid;
                    place-items:center;
                    font-size:32px
                  ">
                    ${
                      item.resourceType === "video"
                        ? "▶"
                        : item.resourceType === "raw"
                          ? "📄"
                          : "📰"
                    }
                  </div>
                `
            }

            <h3>${title}</h3>

            <p style="white-space:pre-line">
              ${description.slice(0, 140)}
            </p>

            <p>
              <strong>Status:</strong>
              ${item.active === true ? "Published" : "Hidden"}
            </p>

            <button
              type="button"
              data-view-marketing="${item.id}"
            >
              View
            </button>

            <button
              type="button"
              data-edit-marketing="${item.id}"
            >
              Edit
            </button>

            <button
              type="button"
              data-delete-marketing="${item.id}"
              style="background:#dc2626"
            >
              Delete
            </button>

          </article>
        `;
      }).join("")}

    </div>
  `;
}

/* ==========================================
   RENDER MARKETING ADMIN
========================================== */

function marketingRender() {
  if (!marketingContainer) return;

  const tabs = Object.entries(MARKETING_TYPES)
    .map(([key, config]) => `
      <button
        type="button"
        data-marketing-tab="${key}"
        style="
          padding:10px 13px;
          margin:4px;
          border:0;
          border-radius:5px;
          cursor:pointer;
          background:${marketingType === key ? "#087f3c" : "#e5eee7"};
          color:${marketingType === key ? "#fff" : "#26352b"};
        "
      >
        ${config.title}
      </button>
    `)
    .join("");

  marketingContainer.innerHTML = `
    <div class="card" style="padding:20px">

      <h2>Marketing Content Management</h2>

      <p>
        Manage Company News, Brochures, Videos,
        Gallery and Print & Press.
      </p>

      <div
        id="marketingAdminMessage"
        role="status"
        style="font-weight:600;margin:12px 0"
      ></div>

    </div>

    <div style="margin:15px 0">
      ${tabs}
    </div>

    ${marketingFormHTML()}

    <div class="card" style="padding:20px">

      <h3>${MARKETING_TYPES[marketingType].title} Records</h3>

      <div id="marketingAdminList">
        ${marketingListHTML()}
      </div>

    </div>
  `;

  marketingAttachEvents();
}

/* ==========================================
   LOAD CUSTOMER MARKETING ITEMS
========================================== */

async function marketingLoadItems() {
  if (!marketingValidateCustomer()) return;

  try {
    const q = query(
      marketingCollection(),
      where("customerId", "==", marketingCustomer.id),
      where("customerUid", "==", marketingCurrentUid())
    );

    const snapshot = await getDocs(q);

    marketingItems = snapshot.docs.map(itemDoc => ({
      id: itemDoc.id,
      ...itemDoc.data()
    }));

    marketingRender();

  } catch (error) {
    console.error("Marketing load error:", error);

    marketingMessage(
      error.message || "Unable to load marketing content.",
      "error"
    );
  }
}

/* ==========================================
   ATTACH EVENTS
========================================== */

function marketingAttachEvents() {
  marketingContainer
    .querySelectorAll("[data-marketing-tab]")
    .forEach(button => {
      button.addEventListener("click", () => {
        marketingType = button.dataset.marketingTab;
        editingMarketingId = null;

        marketingRender();
      });
    });

  marketingContainer
    .querySelector("#marketingAdminForm")
    ?.addEventListener("submit", marketingSave);

  marketingContainer
    .querySelector("#cancelMarketingEdit")
    ?.addEventListener("click", () => {
      editingMarketingId = null;
      marketingRender();
    });

  marketingContainer
    .querySelectorAll("[data-edit-marketing]")
    .forEach(button => {
      button.addEventListener("click", () => {
        editingMarketingId = button.dataset.editMarketing;

        marketingRender();

        marketingContainer
          .querySelector("#marketingAdminForm")
          ?.scrollIntoView({
            behavior: "smooth"
          });
      });
    });

  marketingContainer
    .querySelectorAll("[data-delete-marketing]")
    .forEach(button => {
      button.addEventListener("click", () => {
        marketingDelete(button.dataset.deleteMarketing);
      });
    });

  marketingContainer
    .querySelectorAll("[data-view-marketing]")
    .forEach(button => {
      button.addEventListener("click", () => {
        marketingView(button.dataset.viewMarketing);
      });
    });
}

/* ==========================================
   SAVE MARKETING CONTENT
========================================== */


async function marketingSave(event) {
  event.preventDefault();

  if (!marketingValidateCustomer()) return;

  const title = marketingContainer
    .querySelector("#marketingTitle")
    .value.trim();

  const description = marketingContainer
    .querySelector("#marketingDescription")
    .value.trim();

  const fileInput = marketingContainer
    .querySelector("#marketingFile");

  const thumbnailInput = marketingContainer
    .querySelector("#marketingThumbnail");

  const files = Array.from(fileInput?.files || []);

  const thumbnailFile =
    thumbnailInput?.files?.[0] || null;

  const active = marketingContainer
    .querySelector("#marketingActive")
    .checked;

  if (!title) {
    marketingMessage("Please enter a title.", "error");
    return;
  }

  const existing = editingMarketingId
    ? marketingItems.find(
        item => item.id === editingMarketingId
      )
    : null;

  if (!existing && !files.length) {
    marketingMessage("Please select a file.", "error");
    return;
  }

  if (existing && files.length > 1) {
    marketingMessage(
      "Edit mode mein ek hi file select kijiye.",
      "error"
    );
    return;
  }

  for (const file of files) {
    const error = marketingValidateFile(
      marketingType,
      file
    );

    if (error) {
      marketingMessage(error, "error");
      return;
    }
  }

  if (thumbnailFile) {
    const thumbnailError = marketingValidateFile(
      "gallery",
      thumbnailFile
    );

    if (thumbnailError) {
      marketingMessage(
        "Thumbnail must be JPG, PNG or WebP.",
        "error"
      );
      return;
    }
  }

  const saveButton = marketingContainer
    .querySelector("#saveMarketingBtn");

  const progress = marketingContainer
    .querySelector("#marketingUploadProgress");

  if (!saveButton) return;

  saveButton.disabled = true;

  try {
    let thumbnail = null;

    if (thumbnailFile) {
      progress.textContent = "Uploading thumbnail...";

      thumbnail = await uploadMarketingFile(
        thumbnailFile,
        "gallery"
      );
    }

    /*
       NEW CONTENT:
       Har selected file ka alag Firestore record.
    */

    if (!existing) {
      let completed = 0;

      for (const file of files) {
        completed++;

        progress.textContent =
          `Uploading file ${completed} of ${files.length}: ${file.name}`;

        const uploaded = await uploadMarketingFile(
          file,
          marketingType
        );

        const data = {
          customerId: marketingCustomer.id,
          customerUid: marketingCurrentUid(),

          type: marketingType,
          title,
          description,

          mediaUrl: uploaded.url,
          publicId: uploaded.publicId,
          resourceType: uploaded.resourceType,

          fileName: uploaded.fileName,
          fileFormat: uploaded.format,
          fileSize: uploaded.bytes,

          active,

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        if (thumbnail) {
          data.thumbnailUrl = thumbnail.url;
          data.thumbnailPublicId = thumbnail.publicId;
        }

        await addDoc(marketingCollection(), data);
      }

      marketingMessage(
        `${files.length} file(s) uploaded successfully.`
      );

    } else {

      /*
         EDIT EXISTING CONTENT:
         Sirf selected record update hoga.
      */

      progress.textContent = "Updating content...";

      const data = {
        customerId: marketingCustomer.id,
        customerUid: marketingCurrentUid(),
        type: marketingType,
        title,
        description,
        active,
        updatedAt: serverTimestamp()
      };

      if (files[0]) {
        const uploaded = await uploadMarketingFile(
          files[0],
          marketingType
        );

        data.mediaUrl = uploaded.url;
        data.publicId = uploaded.publicId;
        data.resourceType = uploaded.resourceType;
        data.fileName = uploaded.fileName;
        data.fileFormat = uploaded.format;
        data.fileSize = uploaded.bytes;

      } else {
        data.mediaUrl = existing.mediaUrl || "";
        data.publicId = existing.publicId || "";
        data.resourceType = existing.resourceType || "";
        data.fileName = existing.fileName || "";
        data.fileFormat = existing.fileFormat || "";
        data.fileSize = existing.fileSize || 0;
      }

      if (thumbnail) {
        data.thumbnailUrl = thumbnail.url;
        data.thumbnailPublicId = thumbnail.publicId;

      } else {
        data.thumbnailUrl = existing.thumbnailUrl || "";
        data.thumbnailPublicId =
          existing.thumbnailPublicId || "";
      }

      const existingRef = doc(
        db,
        "marketingItems",
        existing.id
      );

      await updateDoc(existingRef, data);

      marketingMessage("Content updated successfully.");
    }

    editingMarketingId = null;

    await marketingLoadItems();

  } catch (error) {
    console.error("Marketing save error:", error);

    marketingMessage(
      error.message || "Unable to save marketing content.",
      "error"
    );

  } finally {
    if (saveButton) {
      saveButton.disabled = false;
    }

    if (progress) {
      progress.textContent = "";
    }
  }
}


/* ==========================================
   VIEW MARKETING FILE
========================================== */

function marketingView(id) {
  const item = marketingItems.find(
    record => record.id === id
  );

  if (!item) return;

  const url = marketingSafeURL(item.mediaUrl);

  if (!url) {
    marketingMessage(
      "File URL is not available.",
      "error"
    );

    return;
  }

  window.open(url, "_blank", "noopener");
}

/* ==========================================
   DELETE MARKETING CONTENT
========================================== */

async function marketingDelete(id) {
  if (!marketingValidateCustomer()) return;

  const item = marketingItems.find(
    record => record.id === id
  );

  if (!item) return;

  if (!confirm(
    `Delete "${item.title}"? This cannot be undone.`
  )) {
    return;
  }

  try {
    const isOwner =
      item.customerId === marketingCustomer.id &&
      item.customerUid === marketingCurrentUid();

    if (!isOwner) {
      marketingMessage(
        "You cannot delete another customer's content.",
        "error"
      );

      return;
    }

    const itemRef = doc(
      db,
      "marketingItems",
      id
    );

    await deleteDoc(itemRef);

    marketingMessage("Content deleted successfully.");

    editingMarketingId = null;

    await marketingLoadItems();

  } catch (error) {
    console.error("Marketing delete error:", error);

    marketingMessage(
      error.message || "Unable to delete content.",
      "error"
    );
  }
}

/* ==========================================
   PUBLIC FUNCTION
   IMPORT THIS IN customer-admin.js

   renderMarketingAdmin(
     container,
     customer,
     initialType
   )
========================================== */

export async function renderMarketingAdmin(
  container,
  customer,
  initialType = "companyNews"
) {
  marketingContainer = container;
  marketingCustomer = customer;
  editingMarketingId = null;

  marketingType = MARKETING_TYPES[initialType]
    ? initialType
    : "companyNews";

  if (!marketingContainer || !marketingCustomer) {
    console.error(
      "Marketing admin: missing container/customer."
    );

    return;
  }

  marketingContainer.innerHTML =
    "<p>Loading marketing management...</p>";

  await marketingLoadItems();
}
