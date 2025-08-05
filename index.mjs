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
    const { code, state, shop } = req.query;
    
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
    
    // Success page
    res.send(`
      <html>
        <head>
          <title>Authentication Successful - LogoMagic</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f2f5; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .success { color: #28a745; font-size: 4em; margin-bottom: 20px; }
            h1 { color: #333; margin-bottom: 20px; }
            p { color: #666; line-height: 1.6; margin-bottom: 15px; }
            .shop-name { font-weight: bold; color: #007bff; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✅</div>
            <h1>Authentication Successful!</h1>
            <p>Your store <span class="shop-name">${shop}</span> has been connected to LogoMagic.</p>
            <p><strong>You can now close this window</strong> and return to the LogoMagic desktop app.</p>
            <p style="margin-top: 30px; font-size: 14px; color: #999;">This window will automatically close in 3 seconds...</p>
          </div>
          <script>
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `);

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