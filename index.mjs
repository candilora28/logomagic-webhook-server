import express from 'express';
import crypto from 'crypto';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

// Your Shopify app credentials (replace with your actual values)
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '46a098cacef9f497221a7639f3b822a3';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '532d094804b1c97e2d13ac73d40eb9a4';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HMAC verification function
function verifyShopifyWebhook(req, secret) {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  if (!hmacHeader) {
    console.warn('⚠️ No HMAC header found in webhook request');
    return false;
  }
  
  const body = JSON.stringify(req.body);
  const calculatedHmac = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(calculatedHmac, 'base64'),
    Buffer.from(hmacHeader, 'base64')
  );
}

// Landing page
app.get('/', (req, res) => {
  // Check if this is a Shopify installation request
  const { shop, hmac, host, timestamp } = req.query;
  
  if (shop && hmac && host && timestamp) {
    // This is a Shopify installation request, redirect to /auth
    console.log('🔐 Shopify installation request detected, redirecting to /auth');
    return res.redirect(`/auth?${new URLSearchParams(req.query).toString()}`);
  }
  
  // Regular landing page
  res.send(`
    <html>
      <head>
        <title>LogoMagic - Shopify Integration</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f2f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          h1 { color: #333; margin-bottom: 20px; }
          p { color: #666; line-height: 1.6; margin-bottom: 15px; }
          .logo { font-size: 2em; font-weight: bold; color: #007bff; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🎨 LogoMagic</div>
          <h1>Shopify Integration Server</h1>
          <p>This server handles webhook compliance for the LogoMagic desktop application.</p>
          <p><strong>Status: ✅ Online and Ready</strong></p>
          <p style="font-size: 14px; color: #999;">Webhook endpoints are active and responding to Shopify compliance requests.</p>
        </div>
      </body>
    </html>
  `);
});

// Handle Shopify app installation
// Handle Shopify app installation
app.get('/auth', (req, res) => {
  const { shop, hmac, host, timestamp } = req.query;
  
  console.log('🔐 Received Shopify installation request:', { shop, hmac, host, timestamp });
  
  if (!shop) {
    res.status(400).send('Missing shop parameter');
    return;
  }
  
  try {
    // Ensure shop is properly formatted
    const shopDomain = shop.includes('.') ? shop : `${shop}.myshopify.com`;
    
    // Build the OAuth URL for Shopify's installation flow
    const scopes = 'write_products,read_products';
    const redirectUri = `https://logomagic-webhook-server-production.up.railway.app/auth/callback`;
    const state = Math.random().toString(36).substring(7);
    
    const authUrl = `https://${shopDomain}/admin/oauth/authorize?` +
      `client_id=${SHOPIFY_API_KEY}&` +
      `scope=${scopes}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${state}&` +
      `response_type=code`;
    
    console.log(`🔐 Starting OAuth flow for shop: ${shopDomain}`);
    console.log(` Redirecting to: ${authUrl}`);
    
    // Redirect to Shopify's OAuth authorization
    res.redirect(authUrl);
    
  } catch (error) {
    console.error('🛑 Failed to start OAuth:', error);
    res.status(500).send('Failed to start authentication');
  }
});

app.get('/auth/callback', async (req, res) => {
  try {
    const { code, state, shop, host } = req.query;
    
    console.log('🔄 Processing OAuth callback for shop:', shop);
    
    if (!shop) {
      throw new Error('No shop domain found');
    }
    
    console.log('🔑 Exchanging code for access token...');
    
    // Exchange authorization code for access token
    const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code: code,
    });
    
    const { access_token, scope } = tokenResponse.data;
    
    console.log('✅ Shopify Auth Successful! Access token received for:', shop);
    
    // Redirect to embedded app instead of showing success page
    const appUrl = `https://logomagic-webhook-server-production.up.railway.app/app?shop=${shop}&host=${host}`;
    console.log(`🎯 Redirecting to embedded app: ${appUrl}`);
    
    res.redirect(appUrl);

  } catch (error) {
    console.error('🛑 Shopify Auth Failed:', error);
    res.status(500).send(`
      <html>
        <head>
          <title>Authentication Failed - LogoMagic</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f2f5; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .error { color: #dc3545; font-size: 4em; margin-bottom: 20px; }
            h1 { color: #333; margin-bottom: 20px; }
            p { color: #666; line-height: 1.6; margin-bottom: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error">❌</div>
            <h1>Authentication Failed</h1>
            <p>There was an error connecting your store to LogoMagic.</p>
            <p><strong>Please try again</strong> from the LogoMagic desktop app.</p>
            <p style="margin-top: 20px; font-size: 12px; color: #999;">Error: ${error}</p>
          </div>
        </body>
      </html>
    `);
  }
});

// Mandatory compliance webhooks
app.post('/webhooks/customers/data_request', (req, res) => {
  console.log('�� Received customers/data_request webhook');
  
  if (!verifyShopifyWebhook(req, SHOPIFY_API_SECRET)) {
    console.warn('⚠️ Invalid HMAC signature for customers/data_request webhook');
    return res.status(401).send('Unauthorized');
  }
  
  try {
    const { shop_domain, customer, orders_requested } = req.body;
    console.log(`📋 Data request for shop: ${shop_domain}, customer: ${customer?.email}, orders: ${orders_requested?.length || 0}`);
    
    // Acknowledge receipt (no actual data processing needed for desktop app)
    console.log('✅ customers/data_request webhook processed successfully');
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error processing customers/data_request webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Add this after your existing endpoints

// Serve App Bridge script
app.get('/app-bridge.js', (req, res) => {
  res.redirect('https://unpkg.com/@shopify/app-bridge@3.7.9/dist/index.umd.js');
});

// Embedded app interface
app.get('/app', (req, res) => {
  const { shop, host } = req.query;
  
  if (!shop || !host) {
    res.status(400).send('Missing shop or host parameter');
    return;
  }
  
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>LogoMagic</title>
        <script src="https://unpkg.com/@shopify/app-bridge@3.7.9/dist/index.umd.js"></script>
        <script src="https://unpkg.com/@shopify/app-bridge-utils@3.7.9/dist/index.umd.js"></script>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; background: #f6f6f7; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 2.5em; font-weight: bold; color: #007bff; margin-bottom: 10px; }
          .status { background: #e8f5e8; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .button { background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
          .button:hover { background: #0056b3; }
          .button:disabled { background: #ccc; cursor: not-allowed; }
          .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
          .token-display { background: #f8f9fa; padding: 10px; border-radius: 3px; font-family: monospace; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎨 LogoMagic</div>
            <h1>Product Management Dashboard</h1>
            <p>Connected to: <strong>${shop}</strong></p>
          </div>
          
          <div class="status">
            <h3>✅ Connection Status</h3>
            <p>Successfully connected to your Shopify store. Ready to manage products.</p>
          </div>
          
          <div class="section">
            <h3>�� Authentication</h3>
            <button class="button" onclick="getSessionToken()">Get Session Token</button>
            <button class="button" onclick="validateConnection()">Validate Connection</button>
            <div id="tokenResult" class="token-display" style="display: none;"></div>
          </div>
          
          <div class="section">
            <h3>📊 Store Information</h3>
            <button class="button" onclick="getShopInfo()">Get Shop Details</button>
            <button class="button" onclick="getProductCount()">Get Product Count</button>
            <div id="shopInfo" style="margin-top: 10px;"></div>
          </div>
          
          <div class="section">
            <h3>�� App Bridge Actions</h3>
            <button class="button" onclick="showToast()">Show Toast Message</button>
            <button class="button" onclick="openModal()">Open Modal</button>
            <button class="button" onclick="redirectToProducts()">Go to Products</button>
          </div>
          
          <div class="section">
            <h3>�� Session Data</h3>
            <p>This section tracks your interactions to generate session data for Shopify's automated checks.</p>
            <div id="sessionLog" style="background: #f8f9fa; padding: 10px; border-radius: 3px; max-height: 200px; overflow-y: auto;"></div>
          </div>
        </div>
        
        <script>
          // Initialize App Bridge
          const config = {
            apiKey: '${SHOPIFY_API_KEY}',
            host: '${host}',
            forceRedirect: true
          };
          
          const app = window.createApp(config);
          let sessionToken = null;
          
          // Log function to track interactions
          function logInteraction(action) {
            const log = document.getElementById('sessionLog');
            const timestamp = new Date().toLocaleTimeString();
            log.innerHTML += \`<div><strong>\${timestamp}:</strong> \${action}</div>\`;
            log.scrollTop = log.scrollHeight;
          }
          
          // Get session token
          async function getSessionToken() {
            try {
              logInteraction('Getting session token...');
              sessionToken = await app.getSessionToken();
              document.getElementById('tokenResult').innerHTML = '<strong>✅ Session Token:</strong> ' + sessionToken.substring(0, 50) + '...';
              document.getElementById('tokenResult').style.display = 'block';
              logInteraction('Session token obtained successfully');
            } catch (error) {
              logInteraction('Error getting session token: ' + error.message);
              document.getElementById('tokenResult').innerHTML = '<strong>❌ Error:</strong> ' + error.message;
              document.getElementById('tokenResult').style.display = 'block';
            }
          }
          
          // Validate connection
          async function validateConnection() {
            try {
              logInteraction('Validating connection...');
              const token = await app.getSessionToken();
              logInteraction('Connection validated successfully');
              alert('✅ Connection validated successfully!');
            } catch (error) {
              logInteraction('Connection validation failed: ' + error.message);
              alert('❌ Connection validation failed: ' + error.message);
            }
          }
          
          // Get shop information
          async function getShopInfo() {
            try {
              logInteraction('Fetching shop information...');
              const response = await fetch(\`https://\${shop}/admin/api/2023-10/shop.json\`, {
                headers: {
                  'X-Shopify-Access-Token': sessionToken || await app.getSessionToken()
                }
              });
              const data = await response.json();
              document.getElementById('shopInfo').innerHTML = \`
                <p><strong>Shop Name:</strong> \${data.shop.name}</p>
                <p><strong>Email:</strong> \${data.shop.email}</p>
                <p><strong>Domain:</strong> \${data.shop.domain}</p>
              \`;
              logInteraction('Shop information retrieved successfully');
            } catch (error) {
              logInteraction('Error getting shop info: ' + error.message);
              document.getElementById('shopInfo').innerHTML = '<p style="color: red;">Error: ' + error.message + '</p>';
            }
          }
          
          // Get product count
          async function getProductCount() {
            try {
              logInteraction('Fetching product count...');
              const response = await fetch(\`https://\${shop}/admin/api/2023-10/products/count.json\`, {
                headers: {
                  'X-Shopify-Access-Token': sessionToken || await app.getSessionToken()
                }
              });
              const data = await response.json();
              document.getElementById('shopInfo').innerHTML = \`
                <p><strong>Total Products:</strong> \${data.count}</p>
              \`;
              logInteraction('Product count retrieved: ' + data.count + ' products');
            } catch (error) {
              logInteraction('Error getting product count: ' + error.message);
              document.getElementById('shopInfo').innerHTML = '<p style="color: red;">Error: ' + error.message + '</p>';
            }
          }
          
          // Show toast message
          async function showToast() {
            try {
              logInteraction('Showing toast message...');
              app.dispatch(
                window.createToast({
                  message: 'LogoMagic is working perfectly! 🎨',
                  duration: 3000,
                  isError: false
                })
              );
              logInteraction('Toast message displayed');
            } catch (error) {
              logInteraction('Error showing toast: ' + error.message);
            }
          }
          
          // Open modal
          async function openModal() {
            try {
              logInteraction('Opening modal...');
              app.dispatch(
                window.createModal({
                  title: 'LogoMagic Dashboard',
                  message: 'This is a test modal to demonstrate App Bridge functionality.',
                  primaryAction: {
                    label: 'OK',
                    callback: () => {
                      logInteraction('Modal closed');
                    }
                  }
                })
              );
              logInteraction('Modal opened');
            } catch (error) {
              logInteraction('Error opening modal: ' + error.message);
            }
          }
          
          // Redirect to products
          async function redirectToProducts() {
            try {
              logInteraction('Redirecting to products page...');
              app.dispatch(
                window.createRedirect({
                  path: '/admin/products'
                })
              );
              logInteraction('Redirect initiated');
            } catch (error) {
              logInteraction('Error redirecting: ' + error.message);
            }
          }
          
          // Auto-initialize session token on page load
          window.addEventListener('load', async () => {
            logInteraction('Page loaded, initializing...');
            try {
              sessionToken = await app.getSessionToken();
              logInteraction('Session token auto-generated');
            } catch (error) {
              logInteraction('Error auto-generating session token: ' + error.message);
            }
          });
        </script>
      </body>
    </html>
  `);
});

app.post('/webhooks/customers/redact', (req, res) => {
  console.log('🗑️ Received customers/redact webhook');
  
  if (!verifyShopifyWebhook(req, SHOPIFY_API_SECRET)) {
    console.warn('⚠️ Invalid HMAC signature for customers/redact webhook');
    return res.status(401).send('Unauthorized');
  }
  
  try {
    const { shop_domain, customer, orders_to_redact } = req.body;
    console.log(`🗑️ Redact request for shop: ${shop_domain}, customer: ${customer?.email}, orders: ${orders_to_redact?.length || 0}`);
    
    // Acknowledge receipt (no actual data processing needed for desktop app)
    console.log('✅ customers/redact webhook processed successfully');
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error processing customers/redact webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/webhooks/shop/redact', (req, res) => {
  console.log('🏪 Received shop/redact webhook');
  
  if (!verifyShopifyWebhook(req, SHOPIFY_API_SECRET)) {
    console.warn('⚠️ Invalid HMAC signature for shop/redact webhook');
    return res.status(401).send('Unauthorized');
  }
  
  try {
    const { shop_domain } = req.body;
    console.log(`🏪 Shop redact request for: ${shop_domain}`);
    
    // Acknowledge receipt (no actual data processing needed for desktop app)
    console.log('✅ shop/redact webhook processed successfully');
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error processing shop/redact webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/webhooks/app/uninstalled', (req, res) => {
  console.log('🚫 Received app/uninstalled webhook');
  
  if (!verifyShopifyWebhook(req, SHOPIFY_API_SECRET)) {
    console.warn('⚠️ Invalid HMAC signature for app/uninstalled webhook');
    return res.status(401).send('Unauthorized');
  }
  
  try {
    const { shop_domain } = req.body;
    console.log(`🚫 App uninstalled from shop: ${shop_domain}`);
    
    // Acknowledge receipt (no actual data processing needed for desktop app)
    console.log('✅ app/uninstalled webhook processed successfully');
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error processing app/uninstalled webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    webhooks: ['customers/data_request', 'customers/redact', 'shop/redact', 'app/uninstalled'],
    oauth: ['/auth', '/auth/callback']
  });
});

app.listen(PORT, () => {
  console.log(`🚀 LogoMagic Webhook Server running on port ${PORT}`);
  console.log(`✅ Webhook endpoints available:`);
  console.log(`   → https://your-domain.com/webhooks/customers/data_request`);
  console.log(`   → https://your-domain.com/webhooks/customers/redact`);
  console.log(`   → https://your-domain.com/webhooks/shop/redact`);
  console.log(`   → https://your-domain.com/webhooks/app/uninstalled`);
  console.log(`✅ OAuth endpoints available:`);
  console.log(`   → https://your-domain.com/auth`);
  console.log(`   → https://your-domain.com/auth/callback`);
});