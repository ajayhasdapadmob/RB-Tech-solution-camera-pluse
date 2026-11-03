
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#071b2b">

  <title>Customer Admin | RB Tech Solution</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f1f5f9;
      color: #102536;
    }

    header {
      background: #071b2b;
      color: white;
      padding: 18px 22px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    header h1 {
      margin: 0;
      font-size: 21px;
    }

    header p {
      margin: 5px 0 0;
      color: #b9d2df;
      font-size: 13px;
    }

    .container {
      max-width: 1100px;
      margin: auto;
      padding: 22px;
    }

    .panel {
      background: white;
      padding: 22px;
      border-radius: 12px;
      margin-bottom: 20px;
      box-shadow: 0 3px 14px #0000000c;
    }

    .login-panel {
      max-width: 430px;
      margin: 55px auto;
    }

    h2 {
      margin-top: 0;
      font-size: 20px;
    }

    label {
      display: block;
      font-size: 13px;
      font-weight: bold;
      margin: 15px 0 7px;
    }

    input {
      width: 100%;
      padding: 13px;
      border: 1px solid #cbd5e1;
      border-radius: 7px;
      font-size: 15px;
    }

    button {
      border: 0;
      padding: 12px 17px;
      border-radius: 7px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
    }

    .primary {
      background: #087f3c;
      color: white;
    }

    .secondary {
      background: #e2e8f0;
      color: #102536;
    }

    .danger {
      background: #fee2e2;
      color: #b91c1c;
    }

    .block {
      width: 100%;
      margin-top: 18px;
    }

    .message {
      margin-top: 14px;
      font-size: 14px;
      line-height: 1.5;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }

    .stat {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 18px;
      border-radius: 10px;
    }

    .stat span {
      color: #64748b;
      font-size: 13px;
    }

    .stat h3 {
      margin: 10px 0 0;
      font-size: 25px;
      color: #087f3c;
    }

    .menu {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 18px;
    }

    .menu button {
      background: #e2e8f0;
      color: #102536;
    }

    .menu button.active {
      background: #087f3c;
      color: white;
    }

    .section-content {
      min-height: 120px;
      line-height: 1.6;
    }

    footer {
      text-align: center;
      color: #64748b;
      padding: 20px;
      font-size: 13px;
    }

    @media(max-width: 650px) {
      .container {
        padding: 13px;
      }

      .dashboard-grid {
        grid-template-columns: 1fr;
      }

      .login-panel {
        margin: 30px auto;
      }
    }
  </style>
</head>

<body>

<header>
  <div>
    <h1 id="businessTitle">Customer Admin Panel</h1>
    <p>Powered by RB Tech Solution</p>
  </div>

  <button id="logoutBtn" class="danger" type="button" hidden>
    Logout
  </button>
</header>

<main class="container">

  <!-- CUSTOMER LOGIN -->

  <section id="loginSection" class="panel login-panel">

    <h2>Customer Login</h2>

    <p>Login using your registered email and password.</p>

    <form id="customerLoginForm">

      <label for="email">Email Address</label>
      <input
        id="email"
        type="email"
        autocomplete="username"
        placeholder="Enter your email"
        required
      >

      <label for="password">Password</label>
      <input
        id="password"
        type="password"
        autocomplete="current-password"
        placeholder="Enter your password"
        required
      >

      <button class="primary block" type="submit">
        Login
      </button>

    </form>

    <div id="loginMessage" class="message" aria-live="polite"></div>

  </section>

  <!-- CUSTOMER DASHBOARD -->

  <section id="dashboardSection" hidden>

    <div class="panel">
      <h2>Welcome, <span id="customerName">Customer</span></h2>
      <p>Manage your business website from this dashboard.</p>

      <div class="dashboard-grid">

        <div class="stat">
          <span>Total Products</span>
          <h3 id="productCount">0</h3>
        </div>

        <div class="stat">
          <span>Total Enquiries</span>
          <h3 id="enquiryCount">0</h3>
        </div>

        <div class="stat">
          <span>Subscription Status</span>
          <h3 id="subscriptionStatus">--</h3>
        </div>

      </div>
    </div>

    <div class="panel">

      <div class="menu">
        <button type="button" class="active" data-section="overview">
          Dashboard
        </button>

        <button type="button" data-section="products">
          Products
        </button>

        <button type="button" data-section="enquiries">
          Enquiries
        </button>

        <button type="button" data-section="subscription">
          Subscription
        </button>
      </div>

      <div id="sectionContent" class="section-content">
        <h2>Dashboard Overview</h2>
        <p>Your business dashboard will appear here.</p>
      </div>

    </div>

    <div id="dashboardMessage" class="message" aria-live="polite"></div>

  </section>

</main>

<footer>
  © <span id="year"></span> RB Tech Solution
</footer>

<script>
  document.getElementById("year").textContent =
    new Date().getFullYear();
</script>

<script type="module" src="./customer-admin.js"></script>

</body>
</html>
