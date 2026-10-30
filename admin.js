
// GET PRODUCT IMAGE URL
function getProductImageUrl() {
  let imageInput = document.getElementById("productImage");

  if (!imageInput) return "";

  // Automatically replace old file input with URL input
  if (imageInput.type === "file") {
    const newInput = document.createElement("input");

    newInput.type = "url";
    newInput.id = "productImage";
    newInput.name = "productImage";
    newInput.className = imageInput.className;
    newInput.placeholder = "Paste GitHub image URL here";

    imageInput.replaceWith(newInput);
    imageInput = newInput;
  }

  return imageInput.value.trim();
}
