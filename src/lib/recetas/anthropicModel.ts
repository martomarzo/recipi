import Anthropic from "@anthropic-ai/sdk";

// Modelo económico por defecto para parser e estimador de macros
// (Claude Haiku 4.5: $1/M tokens de entrada, $5/M de salida — cada llamada
// cuesta una fracción de centavo). Sobreescribible con ANTHROPIC_MODEL.
export const DEFAULT_MODEL = "claude-haiku-4-5";

/**
 * messages.create con el modelo configurado; si ANTHROPIC_MODEL apunta a un
 * modelo inexistente (404), reintenta una vez con el default en vez de romper
 * el import — pasó en producción con un id de modelo mal escrito.
 */
export async function createWithConfiguredModel(
  client: Anthropic,
  params: Omit<Anthropic.MessageCreateParamsNonStreaming, "model">
): Promise<Anthropic.Message> {
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  try {
    return await client.messages.create({ ...params, model });
  } catch (err) {
    if (model !== DEFAULT_MODEL && err instanceof Anthropic.NotFoundError) {
      console.warn(`ANTHROPIC_MODEL "${model}" no existe — usando ${DEFAULT_MODEL}.`);
      return await client.messages.create({ ...params, model: DEFAULT_MODEL });
    }
    throw err;
  }
}
