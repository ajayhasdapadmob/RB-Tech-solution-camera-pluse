
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";

import {
  auth,
  db,
  storage,
  authReady
} from "./firebase.js";

const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");

const loginForm = document.getElementById("loginForm");
const productForm = document.getElementById("productForm");

const loginMessage = document.getElementById("loginMessage");
const adminMessage = document.getElementById("adminMessage");

const productList = document.getElementById("adminProductList");

let editingImageUrl = "";
let editingImagePath = "";

// Escape HTML
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

// Show message
function showMessage(message, type = "success") {
  adminMessage.textContent = message;
  adminMessage.style.color =
    type === "error" ? "#d00000" : "#087d83";
}

// Check Admin Permission
async function verifyAdmin(user) {
  const adminRef = doc(db, "admins", user.uid);
  const adminSnapshot = await getDoc(adminRef);

  return adminSnapshot.exists() &&
    adminSnapshot.data().active === true;
}

// Login
loginForm.addEventListener("submit", async event => {
  event.preventDefault();

  loginMessage.textContent = "Checking login...";

  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;

  try {
    await authReady;

    const result = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const allowed = await verifyAdmin(result.user);

    if (!allowed) {
      await signOut(auth);
      loginMessage.textContent =
        "Access denied. You are not an authorized admin.";
      return;
    }

    loginMessage.textContent = "Login successful.";

  } catch (error) {
    console.error(error);
    loginMessage.textContent =
      "Login failed: " + error.message;
  }
});

// Authentication state
onAuthStateChanged(auth, async user => {
  loginSection.classList.remove("admin-hidden");
  dashboardSection.classList.add("admin-hidden");

  if (!user) return;

  try {
    await authReady;

    const allowed = await verifyAdmin(user);

    if (!allowed) {
      await signOut(auth);
      loginMessage.textContent = "Admin permission not found.";
      return;
    }

    loginSection.classList.add("admin-hidden");
    dashboardSection.classList.remove("admin-hidden");

    await loadProducts();

  } catch (error) {
    console.error(error);
    loginMessage.textContent = "Admin verification failed.";
    await signOut(auth);
  }
});

// Logout
document.getElementById("logoutBtn").addEventListener(
  "click",
  async () => {
    try {
      await signOut(auth);
      productForm.reset();
      loginMessage.textContent = "Logged out successfully.";
    } catch (error) {
      showMessage(error.message, "error");
    }
  }
);

// Upload Product Image
async function uploadProductImage(file, productId) {
  if (!file) return null;

  if (!file.type.startsWith("image/")) {
    throw new Error("Please select a valid image.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image size must be below 5 MB.");
  }

  const extension = file.name.split(".").pop().toLowerCase();

  const imagePath =
    `products/${productId}/${Date.now()}.${extension}`;

  const imageRef = ref(storage, imagePath);

  await uploadBytes(imageRef, file, {
    contentType: file.type
  });

  const imageUrl = await getDownloadURL(imageRef);

  return {
    imageUrl,
    imagePath
  };
}

// Add or Update Product
productForm.addEventListener("submit", async event => {
  event.preventDefault();

  const user = auth.currentUser;

  if (!user || !(await verifyAdmin(user))) {
    showMessage("Admin permission required.", "error");
    return;
  }

  const name = document.getElementById("productName").value.trim();
  const category = document.getElementById("productCategory").value;
  const model = document.getElementById("productModel").value.trim();
  const priceValue = document.getElementById("productPrice").value;
  const description = document.getElementById("productDescription").value.trim();
  const imageFile = document.getElementById("productImage").files[0];
  const productId = document.getElementById("productId").value;

  if (!name || !category || !description) {
    showMessage("Please fill all required fields.", "error");
    return;
  }

  const price = priceValue === "" ? null : Number(priceValue);

  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    showMessage("Please enter a valid price.", "error");
    return;
  }

  const submitButton = productForm.querySelector(
    'button[type="submit"]'
  );

  submitButton.disabled = true;
  submitButton.textContent = "Saving...";

  try {
    let id = productId;
    let newImage = null;

    if (id) {
      if (imageFile) {
        newImage = await uploadProductImage(imageFile, id);
      }

      const productRef = doc(db, "products", id);

      const updatedData = {
        name,
        category,
        model,
        price,
        description,
        updatedAt: serverTimestamp()
      };

      if (newImage) {
        updatedData.imageUrl = newImage.imageUrl;
        updatedData.imagePath = newImage.imagePath;
      }

      await updateDoc(productRef, updatedData);

      if (newImage && editingImagePath) {
        try {
          await deleteObject(ref(storage, editingImagePath));
        } catch (error) {
          console.warn("Old image cleanup failed:", error);
        }
      }

      showMessage("Product updated successfully.");

    } else {
      const productRef = await addDoc(
        collection(db, "products"),
        {
          name,
          category,
          model,
          price,
          description,
          imageUrl: "",
          imagePath: "",
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      );

      id = productRef.id;

      if (imageFile) {
        newImage = await uploadProductImage(imageFile, id);

        await updateDoc(productRef, {
          imageUrl: newImage.imageUrl,
          imagePath: newImage.imagePath
        });
      }

      showMessage("New product added successfully.");
    }

    productForm.reset();
    document.getElementById("productId").value = "";
    document.getElementById("formHeading").textContent =
      "Add New Product";

    editingImageUrl = "";
    editingImagePath = "";

    await loadProducts();

  } catch (error) {
    console.error(error);
    showMessage(error.message || "Unable to save product.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "SAVE PRODUCT";
  }
});

// Load Products
async function loadProducts() {
  productList.innerHTML = "Loading products...";

  try {
    const snapshot = await getDocs(
      collection(db, "products")
    );

    if (snapshot.empty) {
      productList.innerHTML = "No products added yet.";
      return;
    }

    const products = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    productList.innerHTML = products.map(product => `
      <div class="product-row">

        <div>
          <strong>${escapeHTML(product.name)}</strong>
          <p>${escapeHTML(product.category)}</p>
          <small>Model: ${escapeHTML(product.model || "Not specified")}</small>
          <br>
          <small>
            Price: ${
              product.price === null ||
              product.price === undefined
                ? "Contact for price"
                : "₹" + escapeHTML(product.price)
            }
          </small>
        </div>

        <div>
          <button
            class="edit-btn"
            data-edit="${escapeHTML(product.id)}"
          >
            EDIT
          </button>

          <button
            class="delete-btn"
            data-delete="${escapeHTML(product.id)}"
          >
            DELETE
          </button>
        </div>

      </div>
    `).join("");

  } catch (error) {
    console.error(error);
    productList.textContent =
      "Unable to load products. Check Firestore permissions.";
  }
}

// Edit Product
productList.addEventListener("click", async event => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");

  if (editButton) {
    await editProduct(editButton.dataset.edit);
  }

  if (deleteButton) {
    await removeProduct(deleteButton.dataset.delete);
  }
});

async function editProduct(id) {
  try {
    const snapshot = await getDoc(doc(db, "products", id));

    if (!snapshot.exists()) {
      showMessage("Product not found.", "error");
      return;
    }

    const product = snapshot.data();

    document.getElementById("productId").value = id;
    document.getElementById("productName").value = product.name || "";
    document.getElementById("productCategory").value = product.category || "";
    document.getElementById("productModel").value = product.model || "";
    document.getElementById("productPrice").value =
      product.price ?? "";
    document.getElementById("productDescription").value =
      product.description || "";

    editingImageUrl = product.imageUrl || "";
    editingImagePath = product.imagePath || "";

    document.getElementById("formHeading").textContent =
      "Edit Product";

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  } catch (error) {
    showMessage(error.message, "error");
  }
}

// Delete Product
async function removeProduct(id) {
  if (!confirm("Are you sure you want to delete this product?")) {
    return;
  }

  try {
    if (!auth.currentUser || !(await verifyAdmin(auth.currentUser))) {
      throw new Error("Admin permission required.");
    }

    const productRef = doc(db, "products", id);
    const snapshot = await getDoc(productRef);

    if (!snapshot.exists()) {
      showMessage("Product not found.", "error");
      return;
    }

    const product = snapshot.data();

    await deleteDoc(productRef);

    if (product.imagePath) {
      try {
        await deleteObject(ref(storage, product.imagePath));
      } catch (error) {
        console.warn("Image cleanup failed:", error);
      }
    }

    showMessage("Product deleted successfully.");

    await loadProducts();

  } catch (error) {
    console.error(error);
    showMessage(error.message, "error");
  }
}
