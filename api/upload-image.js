
const admin = require("firebase-admin");

const ALLOWED_ORIGIN = "https://ajayhasdapadmob.github.io";

function initFirebase() {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  return admin.firestore();
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authorization = req.headers.authorization || "";
    const idToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!idToken) {
      return res.status(401).json({ error: "Login required." });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const db = initFirebase();

    const { customerId, fileName, mimeType, imageBase64 } = req.body || {};

    if (!customerId || !fileName || !mimeType || !imageBase64) {
      return res.status(400).json({ error: "Image details are missing." });
    }

    const customerSnap = await db.collection("customers")
      .doc(customerId).get();

    if (!customerSnap.exists) {
      return res.status(403).json({ error: "Customer not found." });
    }

    const customer = customerSnap.data();

    if (customer.uid !== decoded.uid || customer.status !== "active") {
      return res.status(403).json({ error: "Customer access denied." });
    }

    const expiry = customer.subscriptionExpiry?.toDate?.();

    if (!expiry || expiry.getTime() <= Date.now()) {
      return res.status(403).json({ error: "Subscription expired." });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(mimeType)) {
      return res.status(400).json({ error: "Use JPG, PNG or WEBP image." });
    }

    const safeBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(safeBase64, "base64");

    if (!imageBuffer.length || imageBuffer.length > 4 * 1024 * 1024) {
      return res.status(400).json({ error: "Image must be under 4 MB." });
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    const token = process.env.GITHUB_TOKEN;

    if (!owner || !repo || !token) {
      throw new Error("GitHub backend settings are incomplete.");
    }

    const extension = mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp" ? "webp" : "jpg";

    const safeCustomerId = customerId.replace(/[^a-zA-Z0-9_-]/g, "");
    const safeName = fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .slice(0, 50) || "product";

    const uniqueName = `${safeName}-${Date.now()}.${extension}`;
    const path = `images/${safeCustomerId}/${uniqueName}`;

    const githubResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `Upload product image for ${safeCustomerId}`,
          branch,
          content: imageBuffer.toString("base64")
        })
      }
    );

    const githubData = await githubResponse.json();

    if (!githubResponse.ok) {
      console.error("GitHub upload failed:", githubData);
      return res.status(502).json({ error: "GitHub image upload failed." });
    }

    const imageUrl = `https://${owner}.github.io/${repo}/${path}`;

    return res.status(200).json({
      success: true,
      imageUrl,
      path
    });

  } catch (error) {
    console.error("Image upload error:", error);
    return res.status(500).json({
      error: "Image upload failed. Please try again."
    });
  }
};

