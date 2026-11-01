
const productsContainer = document.getElementById("products");

const products = [
  {
    name: "CCTV Camera",
    description: "High quality security camera",
    image: "../images/products/jaise%20camera-01.jpg.png"
  }
];

function showProducts() {
  if (!productsContainer) return;

  productsContainer.innerHTML = "";

  products.forEach((product) => {
    const card = document.createElement("div");
    card.className = "product-card";

    const image = document.createElement("img");
    image.src = product.image;
    image.alt = product.name;

    const title = document.createElement("h3");
    title.textContent = product.name;

    const description = document.createElement("p");
    description.textContent = product.description;

    card.append(image, title, description);
    productsContainer.appendChild(card);
  });
}

showProducts();

const productsContainer = document.getElementById("products");

const products = [
  {
    name: "CCTV Camera",
    description: "High quality security camera",
    image: "../images/products/jaise%20camera-01.jpg.png"
  }
];

function showProducts() {
  if (!productsContainer) return;

  productsContainer.innerHTML = "";

  products.forEach((product) => {
    const card = document.createElement("div");
    card.className = "product-card";

    const image = document.createElement("img");
    image.src = product.image;
    image.alt = product.name;

    const title = document.createElement("h3");
    title.textContent = product.name;

    const description = document.createElement("p");
    description.textContent = product.description;

    card.append(image, title, description);
    productsContainer.appendChild(card);
  });
}

showProducts();

const productsContainer = document.getElementById("products");

const products = [
  {
    name: "CCTV Camera",
    description: "High quality security camera",
    image: "../images/products/jaise%20camera-01.jpg.png"
  }
];

function showProducts() {
  if (!productsContainer) return;

  productsContainer.innerHTML = "";

  products.forEach((product) => {
    const card = document.createElement("div");
    card.className = "product-card";

    const image = document.createElement("img");
    image.src = product.image;
    image.alt = product.name;

    const title = document.createElement("h3");
    title.textContent = product.name;

    const description = document.createElement("p");
    description.textContent = product.description;

    card.append(image, title, description);
    productsContainer.appendChild(card);
  });
}

showProducts();

