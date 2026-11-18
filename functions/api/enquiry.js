
const PROJECT_ID = "rb-tech-solution";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/datastore";

function json(data, status = 200, origin = null) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };

  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return new Response(JSON.stringify(data), { status, headers });
}

function base64UrlBytes(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlJson(value) {
  return base64UrlBytes(
    new TextEncoder().encode(JSON.stringify(value))
  );
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
    base64UrlJson(header) + "." +
    base64UrlJson(payload);

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(account.private_key),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
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
    base64UrlBytes(new Uint8Array(signature));

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type:
        "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  const result = await response.json();

  if (!response.ok || !result.access_token) {
    throw new Error("Authentication failed");
  }

  return result.access_token;
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

function valueString(value) {
  return { stringValue: String(value ?? "") };
}

function valueBoolean(value) {
  return { booleanValue: value === true };
}

async function resolveTenant(request, env) {
  const origin = request.headers.get("Origin");

  if (!origin) {
    throw new Error("Website origin missing");
  }

  const parsedOrigin = new URL(origin);

  if (
    parsedOrigin.protocol !== "https:" ||
    parsedOrigin.origin !== origin
  ) {
    throw new Error("Invalid website origin");
  }

  const hostname = parsedOrigin.hostname.toLowerCase();

  const account = JSON.parse(
    env.FIREBASE_SERVICE_ACCOUNT_JSON
  );

  const token = await getAccessToken(account);

  const website = await firestoreRequest(
    `publicWebsites/${encodeURIComponent(hostname)}`,
    token
  );

  const fields = website.fields || {};

  if (
    fields.active?.booleanValue !== true ||
    fields.domainVerified?.booleanValue !== true ||
    fields.domain?.stringValue?.toLowerCase() !== hostname
  ) {
    throw new Error("Website not verified");
  }

  const customerId = fields.customerId?.stringValue;

  if (!customerId) {
    throw new Error("Customer mapping missing");
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
    throw new Error("Customer subscription inactive");
  }

  return {
    origin,
    hostname,
    customerId,
    token
  };
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

export async function onRequestOptions({ request, env }) {
  try {
    const tenant = await resolveTenant(request, env);

    return new Response(null, {
      status: 204,
      headers: corsHeaders(tenant.origin)
    });
  } catch (error) {
    return json({ error: "Website not authorized" }, 403);
  }
}

export async function onRequestPost({ request, env }) {
  let origin = null;

  try {
    const tenant = await resolveTenant(request, env);
    origin = tenant.origin;

    const body = await request.json();

    const name = String(body.name || "").trim();
    const mobile = String(
      body.mobile || body.phone || ""
    ).trim();

    const product = String(
      body.product || body.productName || ""
    ).trim();

    const message = String(body.message || "").trim();

    if (
      !name ||
      name.length > 100 ||
      mobile.length < 10 ||
      mobile.length > 20 ||
      !product ||
      product.length > 200 ||
      message.length > 2000
    ) {
      return json(
        { error: "Please check enquiry details" },
        400,
        origin
      );
    }

    const fields = {
      customerId: valueString(tenant.customerId),
      name: valueString(name),
      mobile: valueString(mobile),
      email: valueString(body.email),
      company: valueString(body.company),
      country: valueString(body.country),
      state: valueString(body.state),
      city: valueString(body.city),
      pincode: valueString(body.pincode),
      product: valueString(product),
      productName: valueString(body.productName || product),
      productModel: valueString(body.productModel),
      customerProductId: valueString(body.customerProductId),
      productId: valueString(body.productId),
      message: valueString(message),
      enquiryType: valueString(
        body.enquiryType || "Website Enquiry"
      ),
      source: valueString("Verified Website Form"),
      privacyAccepted: valueBoolean(body.privacyAccepted),
      read: valueBoolean(false),
      status: valueString("New"),
      createdAt: {
        timestampValue: new Date().toISOString()
      }
    };

    await firestoreRequest("enquiries", tenant.token, {
      method: "POST",
      body: JSON.stringify({ fields })
    });

    return json(
      {
        success: true,
        message: "Enquiry submitted successfully"
      },
      200,
      origin
    );

  } catch (error) {
    return json(
      { error: "Unable to submit enquiry" },
      403,
      origin
    );
  }
}
