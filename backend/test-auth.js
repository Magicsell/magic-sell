/**
 * Auth API Test Script
 * Kullanım: node test-auth.js
 */

const API_URL = "http://localhost:5000";

async function testAuth() {
  console.log("🧪 Testing Auth API...\n");

  try {
    // 1. Login test
    console.log("1️⃣ Testing Login...");
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@magicsell.com",
        password: "admin123",
      }),
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      throw new Error(`Login failed: ${JSON.stringify(error)}`);
    }

    const loginData = await loginResponse.json();
    console.log("✅ Login successful!");
    console.log(`   Token: ${loginData.token.substring(0, 50)}...`);
    console.log(`   User: ${loginData.user.email} (${loginData.user.role})`);
    console.log(`   Organization: ${loginData.organization.name}\n`);

    const token = loginData.token;

    // 2. Get Me test (protected endpoint)
    console.log("2️⃣ Testing GET /api/auth/me (protected)...");
    const meResponse = await fetch(`${API_URL}/api/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!meResponse.ok) {
      const error = await meResponse.json();
      throw new Error(`Get me failed: ${JSON.stringify(error)}`);
    }

    const meData = await meResponse.json();
    console.log("✅ Get me successful!");
    console.log(`   User: ${meData.user.email} (${meData.user.role})`);
    console.log(`   Organization: ${meData.user.organizationId}\n`);

    // 3. Invalid token test
    console.log("3️⃣ Testing invalid token...");
    const invalidResponse = await fetch(`${API_URL}/api/auth/me`, {
      method: "GET",
      headers: {
        Authorization: "Bearer invalid-token",
      },
    });

    if (invalidResponse.ok) {
      throw new Error("Invalid token should fail!");
    }
    console.log("✅ Invalid token correctly rejected!\n");

    // 4. Driver login test
    console.log("4️⃣ Testing Driver Login...");
    const driverLoginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "driver@magicsell.com",
        password: "driver123",
      }),
    });

    if (!driverLoginResponse.ok) {
      const error = await driverLoginResponse.json();
      throw new Error(`Driver login failed: ${JSON.stringify(error)}`);
    }

    const driverData = await driverLoginResponse.json();
    console.log("✅ Driver login successful!");
    console.log(`   User: ${driverData.user.email} (${driverData.user.role})\n`);

    console.log("🎉 All tests passed!");

  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

testAuth();

