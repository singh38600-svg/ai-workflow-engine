export async function generateOpenRouterCompletion(
  prompt: string,
  systemInstruction?: string,
  responseJson: boolean = false
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || apiKey.includes('MY_OPENROUTER_KEY') || apiKey.trim() === '') {
    throw new Error('OPENROUTER_API_KEY is not configured in environment variables.');
  }

  // Use OPENROUTER_MODEL or OPENROUTER_FALLBACK_MODEL
  const model = process.env.OPENROUTER_MODEL || process.env.OPENROUTER_FALLBACK_MODEL || "google/gemini-2.5-flash";

  console.log(`[generateOpenRouterCompletion] Calling OpenRouter using model: ${model}`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
    "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
    "X-Title": "AI Workflow Engine"
  };

  const body = {
    model: model,
    messages: [
      ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
      { role: "user", content: prompt }
    ],
    response_format: responseJson ? { type: "json_object" } : undefined,
    temperature: 0.2
  };

  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
  } catch (err: any) {
    const fallbackModel = process.env.OPENROUTER_FALLBACK_MODEL;
    if (fallbackModel && fallbackModel !== model) {
      console.warn(`[generateOpenRouterCompletion] Main request failed, trying fallback model: ${fallbackModel}`);
      const fallbackBody = { ...body, model: fallbackModel };
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify(fallbackBody)
      });
    } else {
      throw err;
    }
  }

  if (!response.ok) {
    const fallbackModel = process.env.OPENROUTER_FALLBACK_MODEL;
    if (fallbackModel && fallbackModel !== model) {
      console.warn(`[generateOpenRouterCompletion] Main model request returned status ${response.status}. Trying fallback model: ${fallbackModel}`);
      const fallbackBody = { ...body, model: fallbackModel };
      const fallbackRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify(fallbackBody)
      });
      if (fallbackRes.ok) {
        response = fallbackRes;
      }
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API call failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('OpenRouter API returned a response with no choices content.');
  }

  return content.trim();
}
