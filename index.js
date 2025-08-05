const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Your Shopify app credentials (replace with your actual values)
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || 'your_api_secret_here';

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
    webhooks: ['customers/data_request', 'customers/redact', 'shop/redact', 'app/uninstalled']
  });
});

app.listen(PORT, () => {
  console.log(`🚀 LogoMagic Webhook Server running on port ${PORT}`);
  console.log(`✅ Webhook endpoints available:`);
  console.log(`   → https://your-domain.com/webhooks/customers/data_request`);
  console.log(`   → https://your-domain.com/webhooks/customers/redact`);
  console.log(`   → https://your-domain.com/webhooks/shop/redact`);
  console.log(`   → https://your-domain.com/webhooks/app/uninstalled`);
});