import { z } from "zod";

/**
 * Provider configuration is optional at build time: the application has an
 * explicit, user-visible unavailable-provider path. Invalid or blank values
 * therefore disable only the affected provider instead of crashing the app.
 */
const optionalProviderValue = z.string().trim().min(1).optional().catch(undefined);

export const providerEnvironmentSchema = z.object({
  GROQ_API_KEY: optionalProviderValue,
  GROQ_MODEL: optionalProviderValue,
  CLOUDFLARE_ACCOUNT_ID: optionalProviderValue,
  CLOUDFLARE_AI_TOKEN: optionalProviderValue,
});

export type ProviderEnvironment = z.infer<typeof providerEnvironmentSchema>;

export function readProviderEnvironment(
  env: Record<string, string | undefined> = process.env,
): ProviderEnvironment {
  return providerEnvironmentSchema.parse(env);
}
