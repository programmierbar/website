import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod'

export const ResponseSchema = z.object({
  confidenceScore: z
    .number()
    .min(0, )
    .max(1, ),
  isSpam: z
    .boolean(),
  reason: z
    .string(),
})

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

const FAIL_OPEN_RESULT = {
  isSpam: false,
  reason: 'AI validation unavailable; message allowed through.',
  confidenceScore: 0,
}

export async function filterSpam(input: { name: string, email: string, message: string }): Promise<{
  isSpam: boolean,
  reason: string,
  confidenceScore: number
}> {
  const { name, email, message } = input;

  const apiKey = useRuntimeConfig().geminiApiKey
  if (!apiKey) {
    console.error('Gemini API key (NUXT_GEMINI_API_KEY) is not configured.');
    return FAIL_OPEN_RESULT
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const prompt = getValidationPrompt(name, email, message);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const jsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const validation = ResponseSchema.parse(JSON.parse(jsonString));

    console.log('Gemini Validation: isSpam=%s, confidenceScore=%s', validation.isSpam, validation.confidenceScore);

    return validation;
  } catch (error) {
    console.error('Error during Gemini validation or processing:', error);
    return FAIL_OPEN_RESULT
  }
}
