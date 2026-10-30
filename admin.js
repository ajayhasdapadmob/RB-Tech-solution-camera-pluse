
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
  auth,
  db,
  authReady
} from "./firebase.js";

const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");

const loginForm = document.getElementById("loginForm");
const productForm = document.getElementById("productForm");

const loginMessage = document.getElementById("loginMessage");
const adminMessage = document.getElementById("adminMessage");

const productList = document.getElementById("adminProductList");

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function showMessage(message, type = "success") {
  if (!adminMessage) return;

  adminMessage.textContent = message;
  adminMessage.style.color =
    type === "error" ? "#d00000" : "#087d83";
}

// ADMIN PERMISSION CHECK
async function verifyAdmin(user) {
  if (!user) return false;

  const adminRef = doc(db, "admin", user.uid);
  const adminSnapshot = await getDoc(adminRef);

  return (
    adminSnapshot.exists() &&
    adminSnapshot.data().Active === true
  );
}

// ADMIN LOGIN
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
    console.error("Login error:", error);
    loginMessage.textContent =
      "Login failed: " + error.message;
  }
});

// AUTHENTICATION STATE
onAuthStateChanged(auth, async user => {
  loginSection.classList.remove("admin-hidden");
  dashboardSection.classList.add("admin-hidden");

  if (!user) return;

  try {
    await authReady;

    const allowed = await verifyAdmin(user);

    if (!allowed) {
      await signOut(auth);
      loginMessage.textContent =
        "Access denied. Admin permission not found.";
      return;
    }

    loginSection.classList.add("admin-hidden");
    dashboardSection.classList.remove("admin-hidden");

    await loadProducts();

  } catch (error) {
    console.error("Admin verification error:", error);
    loginMessage.textContent =
      "Admin verification failed: " + error.message;

    await signOut(auth);
  }
});

// LOGOUT
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

// GET PRODUCT IMAGE URL
function getProductImageUrl() {
  const imageInput = document.getElementById("productImage");

  if (!imageInput) return "";

  if (imageInput.type === "file") {
    if (imageInput.files && imageInput.files.length > 0) {
      throw new Error(
        "Please change the image field to a URL input. Firebase Storage is not used."
      );
    }
    return "";
  }

  return imageInput.value.trim();
}

// ADD OR UPDATE PRODUCT
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
  const description =
    document.getElementById("productDescription").value.trim();

  const productId = document.getElementById("productId").value;

  let imageUrl = "";

  try {
    imageUrl = getProductImageUrl();
  } catch (error) {
    showMessage(error.message, "error");
    return;
  }

  if (!name || !category || !description) {
    showMessage("Please fill all required fields.", "error");
    return;
  }

  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    showMessage("Please enter a valid image URL.", "error");
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
    if (productId) {
      const productRef = doc(db, "products", productId);
      const oldSnapshot = await getDoc(productRef);

      if (!oldSnapshot.exists()) {
        throw new Error("Product not found.");
      }

      const updatedData = {
        name,
        category,
        model,
        price,
        description,
        updatedAt: serverTimestamp()
      };

      if (imageUrl) {
        updatedData.imageUrl = imageUrl;
      }

      await updateDoc(productRef, updatedData);

      showMessage("Product updated successfully.");

    } else {
      await addDoc(collection(db, "products"), {
        name,
        category,
        model,
        price,
        description,
        imageUrl,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      showMessage("New product added successfully.");
    }

    productForm.reset();

    document.getElementById("productId").value = "";
    document.getElementById("formHeading").textContent =
      "Add New Product";

    await loadProducts();

  } catch (error) {
    console.error("Product save error:", error);
    showMessage(
      error.message || "Unable to save product.",
      "error"
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "SAVE PRODUCT";
  }
});

// LOAD PRODUCTS
async function loadProducts() {
  productList.innerHTML = "Loading products...";

  try {
    const snapshot = await getDocs(collection(db, "products"));

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
              product.price === null || product.price === undefined
                ? "Contact for price"
                : "₹" + escapeHTML(product.price)
            }
          </small>
        </div>

        <div>
          <button class="edit-btn"
            data-edit="${escapeHTML(product.id)}">
            EDIT
          </button>

          <button class="delete-btn"
            data-delete="${escapeHTML(product.id)}">
            DELETE
          </button>
        </div>
      </div>
    `).join("");

  } catch (error) {
    console.error("Load products error:", error);
    productList.textContent =
      "Unable to load products. Check Firestore permissions.";
  }
}

// EDIT AND DELETE BUTTONS
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

// EDIT PRODUCT
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
    document.getElementById("productCategory").value =
      product.category || "";
    document.getElementById("productModel").value = product.model || "";
    document.getElementById("productPrice").value =
      product.price ?? "";
    document.getElementById("productDescription").value =
      product.description || "";

    const imageInput = document.getElementById("productImage");

    if (imageInput && imageInput.type !== "file") {
      imageInput.value = product.imageUrl || "";
    }

    document.getElementById("formHeading").textContent =
      "Edit Product";

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  } catch (error) {
    console.error(error);
    showMessage(error.message, "error");
  }
}

// DELETE PRODUCT
async function removeProduct(id) {
  if (!confirm("Are you sure you want to delete this product?")) {
    return;
  }

  try {
    if (!auth.currentUser || !(await verifyAdmin(auth.currentUser))) {
      throw new Error("Admin permission required.");
    }

    await deleteDoc(doc(db, "products", id));

    showMessage("Product deleted successfully.");

    await loadProducts();

  } catch (error) {
    console.error(error);
    showMessage(error.message, "error");
  }
}
