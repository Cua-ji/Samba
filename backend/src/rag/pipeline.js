import { retrieveSymbolicContext } from './retrieval.js';
import { generateGroundedResponse } from './generator.js';

export async function runRagPipeline(user, userQuery, mealsCatalog, workoutsCatalog) {
  // Paso A: Retrieval desde el Motor Simbolico
  const retrieval = retrieveSymbolicContext(user, userQuery, mealsCatalog, workoutsCatalog);

  // Paso B: Augmented Generation con System Prompt auditado o Fallback Local
  const generation = await generateGroundedResponse(userQuery, retrieval);

  return {
    answer: generation.answer,
    providerUsed: generation.providerUsed,
    modelUsed: generation.modelUsed,
    retrieval: {
      intent: retrieval.intent,
      profileSummary: retrieval.profileSummary,
      validMealsCount: retrieval.validMealsCount,
      validWorkoutsCount: retrieval.validWorkoutsCount,
      documents: retrieval.documents,
      discardTraces: retrieval.discardTraces,
      activeRules: retrieval.activeRules,
    },
    systemPromptPreview: generation.systemPromptPreview,
  };
}
