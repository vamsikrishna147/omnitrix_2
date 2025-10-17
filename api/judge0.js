// This is a Vercel Serverless Function. It acts as a secure backend proxy
// to the Judge0 Code Execution API.
//
// Why is this needed?
// 1. Security: It hides your secret RapidAPI key for Judge0.
// 2. Execution: It allows your web-based editor to run code in languages
//    that a browser cannot execute on its own (like Python, Java, C++, etc.).

// Vercel automatically maps this file to the '/api/judge0' endpoint.
export default async function handler(request, response) {
    // 1. Ensure the request is a POST request.
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 2. Extract the language ID and source code from the frontend's request body.
        const { language_id, source_code } = request.body;
        
        // 3. Validate that both required fields were sent.
        if (!language_id || source_code === undefined) {
            return response.status(400).json({ error: 'language_id and source_code are required' });
        }

        // 4. Securely access the Judge0 API key from Vercel's environment variables.
        const API_KEY = process.env.JUDGE0_API_KEY;
        const API_HOST = 'judge0-ce.p.rapidapi.com';

        if (!API_KEY) {
            return response.status(500).json({ error: 'Judge0 API key not configured on the server' });
        }

        // 5. Prepare the request options for the Judge0 API, including the secure headers.
        const options = {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'X-RapidAPI-Key': API_KEY,
                'X-RapidAPI-Host': API_HOST
            },
            body: JSON.stringify({
                language_id: language_id,
                source_code: source_code
            })
        };

        // 6. Make the API call to Judge0 to execute the code.
        // The `wait=true` parameter tells Judge0 to wait for the execution to finish
        // before sending the response.
        const judgeResponse = await fetch('https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true', options);
        
        // 7. Handle potential errors from the Judge0 API.
        if (!judgeResponse.ok) {
            const errorBody = await judgeResponse.text();
            console.error('Judge0 API Error:', errorBody);
            return response.status(judgeResponse.status).json({ error: `Judge0 API error: ${errorBody}` });
        }
        
        // 8. Parse the successful JSON response from Judge0.
        const result = await judgeResponse.json();
        
        // 9. Send the entire result object (which includes stdout, stderr, compile output, etc.)
        // back to the frontend.
        return response.status(200).json(result);

    } catch (error) {
        // 10. Catch any unexpected errors and return a generic server error.
        console.error('Error in Judge0 proxy function:', error);
        return response.status(500).json({ error: 'An internal server error occurred.' });
    }
}

