const express = require('express');
const axios = require('axios');
const cors = require('cors');
const swaggerParser = require('swagger-parser');
const app = express();
const PORT = 5000;

// Middleware to handle JSON body and CORS
app.use(express.json());
app.use(cors());

// Store Swagger data
let swaggerData = null;

// Fetch and store Swagger JSON from the URL
app.post('/fetch-swagger', async (req, res) => {
  const { swaggerUrl } = req.body;

  try {
    const response = await axios.get(swaggerUrl);
    swaggerData = await swaggerParser.dereference(response.data); // Parse and dereference
    res.json({ message: 'Swagger data fetched successfully!', swaggerData });
  } catch (error) {
    console.error('Error fetching Swagger:', error);
    res.status(500).json({ message: 'Error fetching Swagger data', error: error.message });
  }
});

// API to send Swagger data to the frontend
app.get('/get-swagger', (req, res) => {
  if (swaggerData) {
    res.json(swaggerData);
  } else {
    res.status(404).json({ message: 'No Swagger data found' });
  }
});

// API to test a request manually filled by the user against Swagger schema
app.post('/test-request', (req, res) => {
  const { method, endpoint, requestData, headers } = req.body;

  console.log('Received Method:', method);
  console.log('Received Endpoint:', endpoint);
  console.log('Received Request Data:', requestData);
  console.log('Received Headers:', headers);

  if (!swaggerData) {
    return res.status(500).json({ message: 'Swagger data is not loaded' });
  }

  const pathData = swaggerData.paths[endpoint]?.[method.toLowerCase()];

  // If pathData is not found, respond with a 404
  if (!pathData) {
    console.error('Endpoint or method not found in Swagger data');
    return res.status(404).json({ message: 'Endpoint or method not found in Swagger data' });
  }

  // 1. Schema Validation (Already implemented)
  const requiredFields = pathData.parameters?.filter(p => p.required)?.map(p => p.name) || [];
  const missingFields = requiredFields.filter(field => !requestData.hasOwnProperty(field));

  if (missingFields.length) {
    console.error('Missing required fields:', missingFields);
    return res.status(400).json({ message: 'Missing required fields', missingFields });
  }

  // 2. HTTP Method Validation
  const validMethods = Object.keys(swaggerData.paths[endpoint]);
  if (!validMethods.includes(method.toLowerCase())) {
    console.error(`Invalid method. Allowed methods: ${validMethods.join(', ')}`);
    return res.status(405).json({ message: 'Invalid method for this endpoint', validMethods });
  }

  // 3. Content-Type Validation
  const expectedContentType = pathData.consumes?.[0] || 'application/json';  // Default to JSON
  if (headers['Content-Type'] !== expectedContentType) {
    console.error(`Invalid Content-Type. Expected ${expectedContentType}`);
    return res.status(415).json({ message: `Invalid Content-Type. Expected ${expectedContentType}` });
  }

  // 4. Response Status Validation (Checking for expected status codes)
  const expectedResponses = Object.keys(pathData.responses || {});
  if (!expectedResponses.includes('200')) {
    console.error('No 200 response defined in Swagger for this endpoint');
    return res.status(500).json({ message: 'No 200 response defined in Swagger for this endpoint' });
  }

  // 5. Authentication Requirement Validation
  const authRequired = pathData.security?.length > 0;
  if (authRequired && !headers['Authorization']) {
    console.error('Missing Authorization header for this endpoint');
    return res.status(401).json({ message: 'Authorization required for this endpoint' });
  }

  // If all validations pass
  res.json({ message: 'Request passed all validations' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
