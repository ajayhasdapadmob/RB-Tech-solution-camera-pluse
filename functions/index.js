
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const {
  getFirestore,
  Timestamp,
  FieldValue
} = require("firebase-admin/firestore");
const crypto = require("crypto");

initializeApp();

const auth = getAuth();
const db = getFirestore();

async function verifyMasterAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Please login first.");
  }

  const adminSnap = await db
    .collection("admin")
    .doc(request.auth.uid)
    .get();

  if (!adminSnap.exists) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  const admin = adminSnap.data();

  if (admin.Active !== true || admin.Role !== "MasterAdmin") {
    throw new HttpsError("permission-denied", "Master Admin access required.");
  }

  return request.auth.uid;
}

// Create a customer account
exports.createCustomer = onCall(async (request) => {
  await verifyMasterAdmin(request);

  const { name, email, phone, password, expiryDate } = request.data || {};

  if (!name || !email || !phone || !expiryDate) {
    throw new HttpsError("invalid-argument", "Name, email, phone and expiry date are required.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
    throw new HttpsError("invalid-argument", "Expiry date must be YYYY-MM-DD.");
  }

  const expiry = new Date(`${expiryDate}T18:29:59.999Z`);

  if (Number.isNaN(expiry.getTime()) || expiry <= new Date()) {
    throw new HttpsError("invalid-argument", "Expiry date must be in the future.");
  }

  let userRecord;

  try {
    const initialPassword =
      password && String(password).length >= 8
        ? String(password)
        : crypto.randomBytes(18).toString("base64url");

    userRecord = await auth.createUser({
      email: String(email).trim().toLowerCase(),
      password: initialPassword,
      displayName: String(name).trim(),
      disabled: false
    });

    const customerRef = db.collection("customers").doc();

    await customerRef.set({
      customerId: customerRef.id,
      uid: userRecord.uid,
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: String(phone).trim(),
      status: "active",
      subscriptionExpiry: Timestamp.fromDate(expiry),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    const resetLink = await auth.generatePasswordResetLink(
      String(email).trim().toLowerCase()
    );

    return {
      success: true,
      customerId: customerRef.id,
      uid: userRecord.uid,
      resetLink
    };

  } catch (error) {
    if (userRecord) {
      await auth.deleteUser(userRecord.uid).catch(() => {});
    }

    if (error instanceof HttpsError) throw error;

    console.error("Create customer error:", error);

    throw new HttpsError(
      "internal",
      error.code === "auth/email-already-exists"
        ? "This email is already registered."
        : "Could not create customer account."
    );
  }
});

// Update customer details, subscription and status
exports.updateCustomer = onCall(async (request) => {
  await verifyMasterAdmin(request);

  const {
    customerId,
    name,
    phone,
    expiryDate,
    status
  } = request.data || {};

  if (!customerId) {
    throw new HttpsError("invalid-argument", "Customer ID is required.");
  }

  const customerRef = db.collection("customers").doc(customerId);
  const customerSnap = await customerRef.get();

  if (!customerSnap.exists) {
    throw new HttpsError("not-found", "Customer not found.");
  }

  const updates = {
    updatedAt: FieldValue.serverTimestamp()
  };

  if (name !== undefined) updates.name = String(name).trim();
  if (phone !== undefined) updates.phone = String(phone).trim();

  if (status !== undefined) {
    if (!["active", "inactive"].includes(status)) {
      throw new HttpsError("invalid-argument", "Invalid customer status.");
    }

    updates.status = status;

    const uid = customerSnap.data().uid;
    await auth.updateUser(uid, { disabled: status !== "active" });
  }

  if (expiryDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
      throw new HttpsError("invalid-argument", "Invalid expiry date.");
    }

    const expiry = new Date(`${expiryDate}T18:29:59.999Z`);

    if (Number.isNaN(expiry.getTime())) {
      throw new HttpsError("invalid-argument", "Invalid expiry date.");
    }

    updates.subscriptionExpiry = Timestamp.fromDate(expiry);
  }

  await customerRef.update(updates);

  return { success: true };
});

// Generate password reset link for a customer
exports.resetCustomerPassword = onCall(async (request) => {
  await verifyMasterAdmin(request);

  const { customerId } = request.data || {};

  if (!customerId) {
    throw new HttpsError("invalid-argument", "Customer ID is required.");
  }

  const customerSnap = await db
    .collection("customers")
    .doc(customerId)
    .get();

  if (!customerSnap.exists) {
    throw new HttpsError("not-found", "Customer not found.");
  }

  const email = customerSnap.data().email;

  const resetLink = await auth.generatePasswordResetLink(email);

  return {
    success: true,
    email,
    resetLink
  };
});
