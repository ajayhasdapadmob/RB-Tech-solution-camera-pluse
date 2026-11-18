
const PROJECT_ID = "rb-tech-solution";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/datastore";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function encodeBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function pemToBytes(pem) {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(clean);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function getAccessToken(account) {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: account.private_key_id
  };

  const payload = {
    iss: account.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  };

  const unsigned =
    encodeBase64Url(JSON.stringify(header)) + "." +
    encodeBase64Url(JSON.stringify(payload));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );

  const assertion =
    unsigned + "." +
    encodeBase64Url(String.fromCharCode(...new Uint8Array(signature)));

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  const result = await response.json();

  if (!response.ok || !result.access_token) {
    throw new Error("Google authentication failed");
  }

  return result.access_token;
}

function field(value) {
  if (typeof value === "boolean") return { booleanValue: value };
  return { stringValue: String(value ?? "") };
}

async function firestoreRequest(path, token, options = {}) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error("Firestore request failed");
  }

  return data;
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      return json({ error: "Backend credentials not configured" }, 500);
    }

    const origin = request.headers.get("Origin");
    const host = new URL(request.url).hostname.toLowerCase();

    if (origin && new URL(origin).hostname.toLowerCase() !== host) {
      return json({ error: "Invalid request origin" }, 403);
    }

    const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    const token = await getAccessToken(account);

    // Resolve customer using the actual website domain.
    const website = await firestoreRequest(
      `publicWebsites/${encodeURIComponent(host)}`,
      token
    );

    const websiteFields = website.fields || {};

    if (
      websiteFields.active?.booleanValue !== true ||
      websiteFields.domainVerified?.booleanValue !== true
    ) {
      return json({ error: "Website domain is not verified or active" }, 403);
    }

    const customerId = websiteFields.customerId?.stringValue;

    if (!customerId) {
      return json({ error: "Customer mapping not found" }, 403);
    }

    const customer = await firestoreRequest(
      `customers/${encodeURIComponent(customerId)}`,
      token
    );

    const customerFields = customer.fields || {};
    const status = customerFields.status?.stringValue;
    const expiry = customerFields.subscriptionExpiry?.timestampValue;

    if (
      status !== "active" ||
      !expiry ||
      new Date(expiry).getTime() <= Date.now()
    ) {
      return json({ error: "Customer subscription is inactive or expired" }, 403);
    }

    const body = await request.json();

    const name = String(body.name || "").trim();
    const mobile = String(body.mobile || body.phone || "").trim();
    const product = String(body.product || body.productName || "").trim();
    const message = String(body.message || "").trim();

    if (!name || name.length > 100 || mobile.length < 10 ||
        mobile.length > 20 || !product || message.length > 2000) {
      return json({ error: "Please check the enquiry details" }, 400);
    }

    const enquiryFields = {
      customerId: field(customerId),
      name: field(name),
      mobile: field(mobile),
      email: field(body.email),
      company: field(body.company),
      country: field(body.country),
      state: field(body.state),
      city: field(body.city),
      pincode: field(body.pincode),
      product: field(product),
      productName: field(body.productName || product),
      productModel: field(body.productModel),
      customerProductId: field(body.customerProductId),
      productId: field(body.productId),
      message: field(message),
      enquiryType: field(body.enquiryType || "Website Enquiry"),
      source: field("Verified Website Form"),
      privacyAccepted: { booleanValue: body.privacyAccepted === true },
      read: { booleanValue: false },
      status: field("New"),
      createdAt: { timestampValue: new Date().toISOString() }
    };

    await firestoreRequest("enquiries", token, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields: enquiryFields })
    });

    return json({ success: true, message: "Enquiry submitted successfully" });

  } catch (error) {
    return json({ error: "Unable to submit enquiry" }, 500);
  }
}
