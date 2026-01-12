import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Allowed origins for CORS - restrict to your application domain
const ALLOWED_ORIGINS = [
  'https://lovable.dev',
  'https://id-preview--xgwhfvwgwdhakshturov.lovable.app',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  // Check if origin is allowed
  const isAllowed = origin && ALLOWED_ORIGINS.some(allowed => 
    origin === allowed || origin.endsWith('.lovable.app') || origin.endsWith('.lovable.dev')
  );
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Check if origin is allowed
  if (!corsHeaders['Access-Control-Allow-Origin']) {
    return new Response('Forbidden: Origin not allowed', { 
      status: 403,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, existingProducts } = await req.json();
    
    // Input validation
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(JSON.stringify({ error: "Invalid request: imageBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Validate imageBase64 format (should be a data URL or base64)
    if (!imageBase64.startsWith('data:') && !/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
      return new Response(JSON.stringify({ error: "Invalid request: imageBase64 format is invalid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Validate size (max 10MB base64)
    if (imageBase64.length > 14 * 1024 * 1024) { // ~10MB in base64
      return new Response(JSON.stringify({ error: "Invalid request: image too large (max 10MB)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Validate existingProducts if provided
    if (existingProducts && !Array.isArray(existingProducts)) {
      return new Response(JSON.stringify({ error: "Invalid request: existingProducts must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Processing invoice image...");
    console.log("Existing products count:", existingProducts?.length || 0);

    // Sanitize product names to prevent prompt injection
    const sanitizedProducts = (existingProducts || []).map((p: { product_name: string; id: string }) => ({
      product_name: String(p.product_name || '').substring(0, 100).replace(/[<>{}[\]]/g, ''),
      id: String(p.id || '')
    }));

    const systemPrompt = `You are an invoice/receipt parser for an inventory management system. 
Extract product information from the invoice image.

For each product found, extract:
- product_name: The name of the product as written on the invoice
- quantity: Number of units
- unit_price: Price per unit (if visible)
- total_price: Total price for this line item (if visible)

Also try to match each product to the existing inventory using fuzzy matching. The existing products are:
${sanitizedProducts.map((p: { product_name: string; id: string }) => `- "${p.product_name}" (ID: ${p.id})`).join('\n') || 'No existing products'}

Return a JSON object with this structure:
{
  "items": [
    {
      "raw_name": "name from invoice",
      "matched_product_id": "uuid or null if no match",
      "matched_product_name": "matched product name or null",
      "confidence": 0.0 to 1.0,
      "quantity": number,
      "unit_price": number or null,
      "total_price": number or null
    }
  ],
  "invoice_total": number or null,
  "invoice_date": "YYYY-MM-DD" or null
}

Be lenient with matching - "Coke" should match "Coca Cola", "Cheetos" should match "Cheetos Hot", etc.
Only return valid JSON, no other text.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: [
              { type: "text", text: "Extract all product information from this invoice image and match to existing inventory:" },
              { type: "image_url", image_url: { url: imageBase64 } }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log("AI response received");

    // Parse the JSON response
    let parsedData;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      parsedData = { items: [], error: "Failed to parse invoice" };
    }

    return new Response(JSON.stringify(parsedData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error processing invoice:", error);
    const origin = req.headers.get('origin');
    const errorCorsHeaders = getCorsHeaders(origin);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...errorCorsHeaders, "Content-Type": "application/json" },
    });
  }
});
