// Gemini API Helper - Substitui Lovable Gateway
// Usa a API nativa do Google Gemini

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiMessage {
  role: 'user' | 'model' | 'system';
  content: string;
}

interface GeminiConfig {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Chama a API do Gemini com formato compatível com OpenAI messages
 * @param messages Array de mensagens no formato {role, content}
 * @param config Configurações opcionais (model, temperature, maxOutputTokens)
 * @returns Texto da resposta do modelo
 */
export async function callGemini(
  messages: GeminiMessage[],
  config: GeminiConfig = {}
): Promise<{ text: string; tokensUsed?: number }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada');
  }

  const model = config.model || 'gemini-2.0-flash';
  const temperature = config.temperature ?? 0.7;
  const maxOutputTokens = config.maxOutputTokens || 2000;

  // Converter mensagens para formato Gemini
  // System message vai no início do prompt do user
  let systemPrompt = '';
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompt = msg.content + '\n\n';
    } else {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.role === 'user' && systemPrompt ? systemPrompt + msg.content : msg.content }]
      });
      // Só adiciona system prompt na primeira mensagem do user
      if (msg.role === 'user' && systemPrompt) {
        systemPrompt = '';
      }
    }
  }

  // Se só tem system message, criar uma mensagem user
  if (contents.length === 0 && systemPrompt) {
    contents.push({
      role: 'user',
      parts: [{ text: systemPrompt }]
    });
  }

  const response = await fetch(
    `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', errorText);
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const tokensUsed = data.usageMetadata?.totalTokenCount;

  return { text, tokensUsed };
}

/**
 * Versão simplificada para prompts únicos
 */
export async function askGemini(
  prompt: string,
  systemPrompt?: string,
  config: GeminiConfig = {}
): Promise<string> {
  const messages: GeminiMessage[] = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push({ role: 'user', content: prompt });

  const result = await callGemini(messages, config);
  return result.text;
}

/**
 * Para extrair JSON estruturado da resposta
 */
export async function askGeminiJSON<T>(
  prompt: string,
  systemPrompt?: string,
  config: GeminiConfig = {}
): Promise<T | null> {
  const fullSystemPrompt = (systemPrompt || '') + '\n\nIMPORTANTE: Responda APENAS com JSON válido, sem markdown ou texto adicional.';

  const text = await askGemini(prompt, fullSystemPrompt, { ...config, temperature: 0.2 });

  try {
    // Tentar extrair JSON da resposta
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }

    // Tentar array
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]) as T;
    }

    return null;
  } catch (e) {
    console.error('Erro ao parsear JSON do Gemini:', text);
    return null;
  }
}
