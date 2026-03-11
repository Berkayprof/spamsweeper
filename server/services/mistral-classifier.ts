// Mistral AI spam classifier service
// Using FREE open-mistral-7b model for spam classification
import axios from 'axios';

export interface SpamClassificationResult {
  isSpam: boolean;
  confidence: number; // 0-100
  reasoning: string;
}

export class MistralClassifierService {
  private readonly DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds delay for rate limiting
  private readonly API_BASE_URL = 'https://api.mistral.ai/v1';

  constructor() {
    if (!process.env.AI_KEY) {
      throw new Error('AI_KEY environment variable is required for Mistral AI');
    }
  }

  async classifyEmail(sender: string, subject: string, body: string): Promise<SpamClassificationResult> {
    const classificationStartTime = Date.now();
    console.log(`🧠 [Mistral] Starting classification for email: "${subject}" from ${sender}`);

    try {
      console.log(`📤 [Mistral] Sending request to Mistral AI...`);
      
      const systemPrompt = `You are an expert spam email classifier. Analyze emails and respond with a JSON object containing:
- "isSpam": boolean (true if spam, false if legitimate)
- "confidence": number 0-100 (how confident you are in this classification)
- "reasoning": string (brief explanation of your decision)

Consider these spam indicators:
- Suspicious sender domains or email addresses
- Promotional language and urgent calls to action
- Poor grammar, spelling mistakes, or unusual formatting
- Suspicious links or attachments mentioned
- Financial scams, phishing attempts, or fraudulent offers
- Unsolicited marketing or sales pitches
- Generic greetings like "Dear Customer" instead of personal names

Consider these legitimate indicators:
- Personal emails from known contacts
- Transactional emails from legitimate services
- Professional communications
- Account notifications from legitimate companies
- Personal correspondence with specific context

Analyze the complete context and content carefully. Respond only with the JSON object, no additional text.`;

      const emailContent = `Analyze this email for spam classification:

From: ${sender}
Subject: ${subject}
Body: ${body.substring(0, 2000)}`; // Limit body to 2000 chars

      const response = await axios.post(
        `${this.API_BASE_URL}/chat/completions`,
        {
          model: 'open-mistral-7b', // Using the free Mistral model
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: emailContent
            }
          ],
          response_format: { type: 'json_object' },
          max_tokens: 1000,
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.AI_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      const responseTime = Date.now() - classificationStartTime;
      console.log(`📡 [Mistral] Response received in ${responseTime}ms`);

      const rawContent = response.data.choices[0]?.message?.content;
      
      if (!rawContent) {
        throw new Error('Empty response from Mistral AI');
      }

      const result = this.parseClassificationResponse(rawContent);

      // Ensure confidence is within valid range
      result.confidence = Math.max(0, Math.min(100, Math.round(result.confidence)));

      const totalTime = Date.now() - classificationStartTime;
      console.log(`✅ [Mistral] Classification completed in ${totalTime}ms: ${result.isSpam ? 'SPAM' : 'NOT SPAM'} (${result.confidence}% confidence)`);
      console.log(`🔍 [Mistral] Reasoning: ${result.reasoning}`);
      
      // Wait before allowing next request (rate limit protection)
      if (this.DELAY_BETWEEN_REQUESTS > 0) {
        console.log(`⏱️ [Mistral] Waiting ${this.DELAY_BETWEEN_REQUESTS}ms before next request...`);
        await new Promise(resolve => setTimeout(resolve, this.DELAY_BETWEEN_REQUESTS));
      }
      
      return result;

    } catch (error) {
      const totalTime = Date.now() - classificationStartTime;
      
      if (axios.isAxiosError(error)) {
        console.error(`❌ [Mistral] HTTP Error after ${totalTime}ms:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
        throw new Error(`Mistral AI API error: ${error.response?.status || 'Unknown'} - ${error.response?.statusText || error.message}`);
      } else {
        console.error(`❌ [Mistral] Error classifying email after ${totalTime}ms:`, error);
        throw new Error(`Failed to classify email with Mistral AI: ${(error as Error).message}`);
      }
    }
  }

  private parseClassificationResponse(raw: string): SpamClassificationResult {
    // Step 1: Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    let cleaned = raw.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim();
      console.log('🔧 [Mistral] Stripped markdown code fence from response');
    }

    // Step 2: Extract the first JSON object using regex (handles leading/trailing text)
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    // Step 3: Try direct JSON.parse
    try {
      const parsed = JSON.parse(cleaned);
      return this.validateAndNormalize(parsed, raw);
    } catch {
      console.warn('⚠️ [Mistral] Direct JSON.parse failed, attempting field extraction');
    }

    // Step 4: Regex-based field extraction as fallback
    const isSpamMatch = cleaned.match(/"isSpam"\s*:\s*(true|false)/i);
    const confidenceMatch = cleaned.match(/"confidence"\s*:\s*(\d+(?:\.\d+)?)/i);
    const reasoningMatch = cleaned.match(/"reasoning"\s*:\s*"((?:[^"\\]|\\.)*)"/i);

    if (isSpamMatch && confidenceMatch) {
      const extracted: SpamClassificationResult = {
        isSpam: isSpamMatch[1].toLowerCase() === 'true',
        confidence: parseFloat(confidenceMatch[1]),
        reasoning: reasoningMatch ? reasoningMatch[1] : 'Extracted from partial response',
      };
      console.log('🔧 [Mistral] Recovered result via field extraction:', extracted);
      return extracted;
    }

    // Step 5: Last resort — try to determine spam from plain text keywords
    console.error('❌ [Mistral] Could not parse response, using text-based fallback. Raw:', raw);
    const lowerRaw = raw.toLowerCase();
    const isSpamFallback = lowerRaw.includes('"isspam": true') || lowerRaw.includes('"is_spam": true');
    return {
      isSpam: isSpamFallback,
      confidence: 30,
      reasoning: 'Fallback classification — response could not be parsed',
    };
  }

  private validateAndNormalize(parsed: any, raw: string): SpamClassificationResult {
    // Normalize common variations of field names
    const isSpam = parsed.isSpam ?? parsed.is_spam ?? parsed.spam ?? null;
    const confidence = parsed.confidence ?? parsed.score ?? parsed.certainty ?? null;
    const reasoning = parsed.reasoning ?? parsed.reason ?? parsed.explanation ?? '';

    if (isSpam === null || confidence === null) {
      console.error('❌ [Mistral] Missing required fields in parsed response. Raw:', raw);
      throw new Error('Missing required fields (isSpam, confidence) in AI response');
    }

    return {
      isSpam: Boolean(isSpam),
      confidence: Number(confidence),
      reasoning: String(reasoning),
    };
  }
}