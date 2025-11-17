import { GoogleGenerativeAI } from '@google/generative-ai';

function getValidationPrompt(name: string, email: string, message: string): string {
  return `
    You are an advanced AI security expert tasked with validating a website's contact form submission.
    Your goal is to distinguish between genuine inquiries and spam, gibberish, or bot-like messages.

    Analyze the following submission details:
    - Name: "${name}"
    - Email: "${email}"
    - Message: "${message}"

    Carefully evaluate the message for the following red flags:
    - Gibberish or random characters.
    - Suspicious links.

    Based on your analysis, respond ONLY with a valid JSON object. Do not add any other text, explanations, or markdown formatting. The JSON object must have the following structure:
    {
      "isSpam": boolean,
      "reason": string,
      "confidenceScore": number
    }

    - "isSpam": Must be true if it is spam, otherwise false.
    - "reason": A brief, one-sentence explanation for your decision.
    - "confidenceScore": A value between 0.0 (definitely not spam) and 1.0 (definitely spam).
  `;
}

export async function filterSpam(input: { name: string, email: string, message: string }) {
  const { name, email, message } = input;

  if (!name || !email || !message) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields.',
    });
  }

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY ?? ''
  if (!apiKey) {
    console.error('Google API Key is not configured.');
    throw createError({
      statusCode: 500,
      statusMessage: 'Server configuration error.',
    });
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  try {
    const prompt = getValidationPrompt(name, email, message);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const jsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const validation = JSON.parse(jsonString);

    console.log('Gemini Validation Result:', validation);

    return validation;

  } catch (error) {
    console.error('Error during Gemini validation or processing:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'An error occurred while validating your message.',
    });
  }
}
