# AI Generation / TTS / External APIs Clean Code Review

## Scope

Reviewed the AI Generation / TTS / External APIs area for:

- Single Responsibility
- Right Logic In Right Layer
- No Duplication Of Rules
- Testable Business Logic
- Clear Boundaries
- Clear Naming
- Avoid Hidden Side Effects

Seven default subagents reviewed the same code area in pure review mode, one principle per subagent. Agents were instructed to include more potential issues rather than fewer.

## Must

1. **TTS storage URL authorization is too weak**  
   `convex/themes.ts:getTtsStorageUrl`  
   Any authenticated user can request a URL for any storage ID. Require `themeId`/word context and verify theme access before returning the URL.

2. **Stored theme TTS ignores user provider preference**  
   `convex/themes.ts:generateThemeTTS`, `app/api/tts/route.ts`, `convex/userPreferences.ts`  
   Live TTS respects `"resemble" | "elevenlabs"`, but stored theme TTS always uses Resemble. Use one shared provider-selection service.

3. **Credit check/consume is not atomic**  
   `app/api/generate/route.ts`, `app/api/tts/route.ts`, `convex/themes.ts`, `convex/users.ts`  
   External API calls happen after a precheck but before final credit consumption. Parallel calls can overspend or waste provider calls. Add reserve/finalize/refund semantics.

4. **`app/api/generate/route.ts` has too many responsibilities**  
   It handles auth, request branching, prompt building, OpenAI calls, retries, validation, credits, and responses. Split into route adapter, generation service, OpenAI adapter, validators, and credit service.

5. **`app/api/tts/route.ts` has too many responsibilities**  
   It mixes auth, provider selection, Resemble/ElevenLabs implementation, fallback, credits, timeout, and response formatting. Extract provider adapters and a TTS orchestration service.

6. **`convex/themes.ts:generateThemeTTS` hides many side effects**  
   It locks, calls provider, stores files, consumes credits, patches theme words, deletes files, and releases locks. Split into explicit planning/generation/storage/credit/apply/cleanup steps.

7. **Theme TTS generation can race on shared themes**  
   `convex/themes.ts:generateThemeTTS` / `applyGeneratedThemeTts`  
   Locking is user-scoped, not theme-scoped, so two editors can generate for the same theme and orphan previous files. Add theme-level locking or apply only when the word still has no TTS ID.

8. **Prompt/debug data is returned to clients**  
   `app/api/generate/route.ts` responses  
   API responses include `prompt`, including validation failures. Remove from normal responses or gate behind explicit dev/debug mode.

9. **Word-type rules are prompt-only in places**  
   `lib/themes/wordTypes.ts`, `lib/generate/prompts.ts`, `lib/themes/serverValidation.ts`  
   Rules like noun articles, verb infinitive markers, adjective/adverb rules are mostly prompt instructions, not enforced validation. Centralize and enforce word-type-aware validation.

10. **Resemble implementation is duplicated and inconsistent**  
    `app/api/tts/route.ts`, `convex/helpers/resembleTts.ts`  
    Live TTS and stored TTS use different Resemble behavior, presets, fallback, config, and provider support. Create one provider abstraction/config.

11. **Theme update deletes storage as a hidden side effect**  
    `convex/themes.ts:updateTheme`  
    Updating words can delete TTS storage files. Make TTS cleanup explicit via a lifecycle helper or clearly named mutation flow.

12. **Resemble preset “get” helper mutates provider state**  
    `app/api/tts/route.ts:getOrCreateResemblePreset`  
    The function may create external provider resources and mutate cache. Rename to `ensureResemblePresetExists` and make side effects clear.

## Might

1. **Wrong-answer count rules differ**  
   Prompts/schemas say exactly `6`; theme validation accepts `3-6`. Decide whether this is intentional and name constants clearly.

2. **Generated TTS stale-apply rule is duplicated**  
   `convex/themes.ts:applyGeneratedThemeTts`, `lib/themes/tts.ts:applyGeneratedTtsToWords`  
   Reuse the pure helper or extend it to return rejected storage IDs.

3. **TTS provider type/default duplicated**  
   `"resemble" | "elevenlabs"` and defaults appear across schema, Convex, API routes, hooks, and UI. Centralize provider values/type/default.

4. **TTS lock duration duplicated**  
   `convex/themes.ts`, `convex/users.ts` both use `10 * 60 * 1000`. Move to one shared Convex constant.

5. **Credit naming is inconsistent**  
   TTS uses “generations”, “credits”, and “cost” for the same allowance concept. Rename consistently or split LLM/TTS credit APIs.

6. **Generated-output validation is split across layers**  
   Route-specific validators duplicate parts of `lib/themes/serverValidation.ts`. Move generation output validation into shared pure functions.

7. **OpenAI output is cast before local runtime validation**  
   `app/api/generate/route.ts:callOpenAIJson`  
   `JSON.parse(content) as T` trusts provider shape. Add local parsing/validation at the adapter boundary.

8. **Generate route branches duplicate workflow**  
   `regenerate-for-word` and `add-word` repeat prompt/call/retry/validate/credit logic. Extract shared flow.

9. **Provider error bodies are logged raw**  
   `app/api/tts/route.ts`, `convex/helpers/resembleTts.ts`, `app/api/generate/route.ts`  
   Sanitize logs to status/code/provider/request ID only.

10. **Email send claim is stored as sent log**  
    `convex/emails/notificationEmails.ts`  
    Claiming in-flight sends uses `emailNotificationLog.sentAt`. Add status like `pending/sent/failed` or a separate claim table.

11. **Email notification action mixes too much**  
    `convex/emails/notificationEmails.ts`  
    It combines preferences, data building, rendering, idempotency, sending, rollback. Split eligibility/data/render/send concerns.

12. **Email data builders are too broad**  
    `buildEmailData` handles multiple triggers and feature lookups. Use per-trigger builders.

13. **`lib/themes/wordTypes.ts` mixes domain, UI, and prompt config**  
    Split stable word-type metadata from prompt wording/UI labels.

14. **Client API helper names hide paid side effects**  
    `lib/themes/api.ts` helpers like `generateTheme` ultimately consume credits server-side. Consider naming/response metadata that makes paid generation explicit.

15. **TTS route fallback can ignore selected provider**  
    If Resemble key is missing, it can fall back to ElevenLabs. Make fallback explicit or return config error.

## Ignore / Low Priority

1. **Ambiguous local variable names in TTS result handling**  
   `generated`, `successful`, `failed`, `applied` could be clearer, but this is lower priority than boundary/credit fixes.

2. **API type names are somewhat vague**  
   `"field"`, `"wrong"`, `"generate-random-words"`, `newWord` could be renamed, but mostly readability cleanup.

3. **`validCount = count` alias adds little value**  
   Minor readability issue only.

4. **`deleteStorageIdsSafely` name is imperfect**  
   “Safely” means dedupe/log/swallow errors, not non-destructive. Worth renaming when touching TTS cleanup, but not urgent.

5. **Unused/unclear word-type config fields may mislead**  
   Fields like `requiresDefiniteArticles` / `markerRule` should be clarified if they are not actively enforced, but this is secondary.

## Validation

No code changed. Validators were skipped.
