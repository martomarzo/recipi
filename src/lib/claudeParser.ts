import Anthropic from '@anthropic-ai/sdk';
import type { ParsedRecipe } from '@/types/recipe';

const SYSTEM_PROMPT = `You are a recipe parser. Extract structured recipe data from raw text and return it as JSON.

Return ONLY a valid JSON object with this exact shape (no markdown, no extra text):
{
  "name": "recipe name",
  "description": "one or two sentence description",
  "ingredients": [
    { "quantity": "2", "unit": "cups", "name": "all-purpose flour" },
    { "quantity": "1", "unit": null, "name": "egg" }
  ],
  "steps": [
    { "position": 1, "text": "Preheat oven to 350°F for 10 minutes." },
    { "position": 2, "text": "Mix dry ingredients in a bowl." }
  ]
}

Rules:
- quantity and unit may be null if not present
- Each step should be a single, self-contained instruction
- Include ALL timing information in the step text (e.g. "bake for 30 minutes", "simmer for 15 minutes")
- Do not split a step just to isolate a timer — keep the timer phrase inside the step where it naturally belongs
- steps positions start at 1 and are sequential
- description should be empty string "" if not determinable from the text`;

export async function parseWithClaude(rawText: string): Promise<ParsedRecipe> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Parse this recipe:\n\n${rawText}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  const raw = textBlock.text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const parsed = JSON.parse(raw) as ParsedRecipe;
  return parsed;
}
