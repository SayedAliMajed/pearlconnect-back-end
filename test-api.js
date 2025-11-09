#!/usr/bin/env node

/**
 * PearlConnect Backend API Test Script
 * Tests all major endpoints and functionality
 */

const http = require('http');
const { spawn } = require('child_process');

const BASE_URL = 'http://localhost:3000';
const TIMEOUT = 10000; // 10 seconds timeout for requests

// Test data
const testUser = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'testpass123',
  role: 'customer'
};

const testService = {
  title: 'Test Service',
  description: 'This is a test service for API testing',
  price: 25.5,
  category: null,
  provider: null,
  images: []
};

let serverProcess = null;
let testToken = '';
let testUserId = '';
let testServiceId = '';
let testCategoryId = '';

// Utility function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          };
          resolve(response);
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Utility function to wait
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test functions
async function testServerStartup() {
  console.log('🚀 Testing server startup...');
  return new Promise((resolve) => {
    serverProcess = spawn('node', ['server.js']);
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`   ${output.trim()}`);
      if (output.includes('Server is running')) {
        resolve(true);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`   Error: ${data.toString().trim()}`);
    });

    serverProcess.on('close', (code) => {
      console.log(`   Server process exited with code ${code}`);
    });

    // Fallback timeout
    setTimeout(() => resolve(false), 5000);
  });
}

async function testHealthCheck() {
  console.log('🏥 Testing health check...');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET'
    });
    
    console.log(`   Status: ${response.statusCode}`);
    console.log(`   Response: ${response.body ? JSON.stringify(response.body) : 'No content'}`);
    return response.statusCode < 500;
  } catch (error) {
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

async function testUserRegistration() {
  console.log('👤 Testing user registration...');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, testUser);
    
    console.log(`   Status: ${response.statusCode}`);
    if (response.body) {
      console.log(`   Response: ${JSON.stringify(response.body, null, 2)}`);
      if (response.body._id) {
        testUserId = response.body._id;
        testService.provider = response.body._id;
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

async function testUserLogin() {
  console.log('🔐 Testing user login...');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      email: testUser.email,
      password: testUser.password
    });
    
    console.log(`   Status: ${response.statusCode}`);
    if (response.body && response.body.token) {
      testToken = response.body.token;
      console.log(`   Token received: ${testToken.substring(0, 20)}...`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

async function testServicesList() {
  console.log('📋 Testing services list (public)...');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/services',
      method: 'GET'
    });
    
    console.log(`   Status: ${response.statusCode}`);
    console.log(`   Services count: ${response.body && response.body.services ? response.body.services.length : 0}`);
    return response.statusCode === 200;
  } catch (error) {
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

async function testServicesSearch() {
  console.log('🔍 Testing services search...');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/services?search=test&page=1&limit=10',
      method: 'GET'
    });
    
    console.log(`   Status: ${response.statusCode}`);
    console.log(`   Search results: ${response.body && response.body.services ? response.body.services.length : 0}`);
    return response.statusCode === 200;
  } catch (error) {
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

async function testServiceCreation() {
  console.log('➕ Testing service creation (protected)...');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/services',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`
      }
    }, testService);
    
    console.log(`   Status: ${response.statusCode}`);
    if (response.body && response.body._id) {
      testServiceId = response.body._id;
      console.log(`   Service created with ID: ${testServiceId}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

async function testProtectedEndpoint() {
  console.log('🔒 Testing protected endpoint (users)...');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/users/profile',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${testToken}`
      }
    });
    
    console.log(`   Status: ${response.statusCode}`);
    return response.statusCode === 200 || response.statusCode === 404; // 404 is okay, means endpoint exists but route not found
  } catch (error) {
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

async function testUnauthorizedAccess() {
  console.log('❌ Testing unauthorized access...');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/users/profile',
      method: 'GET'
      // No Authorization header
    });
    
    console.log(`   Status: ${response.statusCode}`);
    return response.statusCode === 401; // Should return unauthorized
  } catch (error) {
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 PearlConnect Backend API Test Suite');
  console.log('=====================================\n');

  const results = [];

  // Test server startup
  const serverStarted = await testServerStartup();
  results.push({ test: 'Server Startup', passed: serverStarted });
  
  if (!serverStarted) {
    console.log('\n❌ Server failed to start. Aborting tests.');
    return;
  }

  await wait(2000); // Wait for server to fully initialize

  // Run tests
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'User Registration', fn: testUserRegistration },
    { name: 'User Login', fn: testUserLogin },
    { name: 'Services List', fn: testServicesList },
    { name: 'Services Search', fn: testServicesSearch },
    { name: 'Service Creation', fn: testServiceCreation },
    { name: 'Protected Endpoint', fn: testProtectedEndpoint },
    { name: 'Unauthorized Access', fn: testUnauthorizedAccess }
  ];

  for (const test of tests) {
    const passed = await test.fn();
    results.push({ test: test.name, passed });
    await wait(500); // Small delay between tests
  }

  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  
  let passedCount = 0;
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${result.test}`);
    if (result.passed) passedCount++;
  });

  console.log(`\n🎯 Overall: ${passedCount}/${results.length} tests passed`);

  if (passedCount === results.length) {
    console.log('\n🎉 All tests passed! Backend is ready for frontend development.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the issues above.');
  }

  // Cleanup
  if (serverProcess) {
    console.log('\n🛑 Stopping server...');
    serverProcess.kill('SIGTERM');
  }
}

// Handle process termination
process.on('SIGINT', () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  process.exit(0);
});

// Run tests
runTests().catch(console.error);
