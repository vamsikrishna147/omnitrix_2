// This is a Vercel Serverless Function. It acts as a secure backend proxy
// to the Google Gemini API.
//
// Why is this needed?
// 1. Security: It hides your secret API key from the public frontend code.
// 2. Control: It provides a single point to manage API calls, add logging, etc.

// Vercel automatically maps this file to the '/api/gemini' endpoint.
export default async function handler(request, response) {
    // 1. Ensure the request is a POST request, as we're sending data.
    if (request.method !== 'POST') {
        // If not, respond with a "Method Not Allowed" error.
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 2. Extract the 'prompt' from the JSON body of the incoming request from the frontend.
        const { prompt } = request.body;

        // 3. Validate that a prompt was actually sent.
        if (!prompt) {
            return response.status(400).json({ error: 'Prompt is required' });
        }

        // 4. Securely access the API key from Vercel's environment variables.
        // This is the most important step for security. The key is NEVER exposed to the browser.
        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
             // If the key hasn't been set in Vercel's settings, return a server error.
             return response.status(500).json({ error: 'API key not configured on the server' });
        }

        // 5. Construct the full URL for the Gemini API endpoint.
        const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;

        // 6. Create the payload in the format required by the Gemini API.
        const geminiPayload = {
            contents: [{ parts: [{ text: prompt }] }],
        };

        // 7. Make the actual API call from the server to Google's servers.
        const geminiResponse = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload),
        });

        // 8. Handle potential errors from the Gemini API (e.g., bad request, rate limiting).
        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error('Gemini API Error:', errorBody);
            return response.status(geminiResponse.status).json({ error: `Gemini API error: ${errorBody}` });
        }

        // 9. Parse the successful JSON response from Gemini.
        const result = await geminiResponse.json();
        
        // 10. Extract the generated text from the complex response object.
        // We use optional chaining (?.) to prevent errors if the structure is unexpected.
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // 11. Send the final, clean text response back to your frontend.
        return response.status(200).json({ text });

    } catch (error) {
        // 12. Catch any unexpected errors during the process and return a generic server error.
        console.error('Error in serverless function:', error);
        return response.status(500).json({ error: 'An internal server error occurred.' });
    }
}

