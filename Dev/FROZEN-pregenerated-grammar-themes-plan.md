# Pre-generated Grammar Themes

## Overview

Add 10 pre-generated Spanish grammar themes that are seeded into every user's account. These cover word categories that don't fit the "generate via LLM" flow: prepositions, conjunctions, interjections, and pronouns.

Pronoun coverage is split into 6 sub-themes (personales, objeto, preposicionales, demostrativos, relativos, interrogativos, indefinidos) so categories stay grammatically clean. Adverb-like interrogatives (`dónde`, `cómo`, `cuándo`, `por qué`) are intentionally excluded — they belong to the existing `adverbs` word type, not to pronouns.

## Decisions

| Decision | Choice |
|---|---|
| Storage | Copied into each user's account as locked system-provided themes |
| New word types | `prepositions`, `conjunctions`, `interjections`, `pronouns` added to schema |
| Word type model | Split persisted/displayable word types from AI-generatable word types |
| User control | Hard-locked: no edits, additions, deletions, sharing changes, or AI helper actions |
| UI distinction | Read-only locked grammar themes; hide or disable edit/delete/share/generate controls |
| Generate flow | New word types are NOT available in the generate flow |
| TTS | Not included at seed time; user-triggered TTS generation is disabled for locked grammar themes for now |
| Wrong answers | Pre-written as part of the theme data |
| Seeding | Migration script for existing users + seed on new user signup |
| Name limit | Increase theme name max length from 25 to 35 |
| Archive behavior | Locked grammar themes are archivable like regular themes; only the lock prevents editing, deletion, sharing, duplication, regeneration, and TTS changes |

## Themes (10 total)

1. **PREPOSICIONES** — 18 words, word type `prepositions`
2. **CONJUNCIONES** — 15 words, word type `conjunctions`
3. **INTERJECCIONES** — 20 words, word type `interjections`
4. **PRONOMBRES: PERSONALES** — 11 words, word type `pronouns`
5. **PRONOMBRES: OBJETO** — 11 words, word type `pronouns`
6. **PRONOMBRES: PREPOSICIONALES** — 6 words, word type `pronouns`
7. **PRONOMBRES: DEMOSTRATIVOS** — 6 words, word type `pronouns`
8. **PRONOMBRES: RELATIVOS** — 6 words, word type `pronouns`
9. **PRONOMBRES: INTERROGATIVOS** — 4 words, word type `pronouns`
10. **PRONOMBRES: INDEFINIDOS** — 10 words, word type `pronouns`

## Word Data

Use the following pre-generated words, answers, and wrong answers. Each implementation word follows the existing structure: `{ word, answer, wrongAnswers }`.

Each entry below lists 6 wrong answers chosen from the same word category. Accent-stripped twins are intentionally avoided because `normalizeForComparison` strips diacritics, which would otherwise cause the validator to reject them as duplicates of the correct answer (e.g., `mi` is never used as a distractor for `mí`, `que` is never used for `qué`, `quien` is never used for `quién`, `cuanto` is never used for `cuánto`, `donde` is never used for `dónde`).

### PREPOSICIONES

1. `a` — to / at
   - wrong: `en`, `de`, `por`, `para`, `con`, `hacia`
2. `ante` — before / facing
   - wrong: `bajo`, `sobre`, `contra`, `hacia`, `tras`, `entre`
3. `bajo` — under
   - wrong: `sobre`, `entre`, `tras`, `ante`, `contra`, `según`
4. `con` — with
   - wrong: `sin`, `en`, `de`, `para`, `por`, `entre`
5. `contra` — against
   - wrong: `entre`, `ante`, `sobre`, `hacia`, `tras`, `bajo`
6. `de` — of / from
   - wrong: `a`, `en`, `por`, `para`, `con`, `desde`
7. `desde` — since / from
   - wrong: `hasta`, `hacia`, `de`, `por`, `tras`, `según`
8. `durante` — during
   - wrong: `en`, `por`, `hasta`, `desde`, `entre`, `tras`
9. `en` — in / on / at
   - wrong: `a`, `de`, `por`, `con`, `sobre`, `entre`
10. `entre` — between / among
    - wrong: `sobre`, `ante`, `contra`, `bajo`, `tras`, `según`
11. `hacia` — toward
    - wrong: `hasta`, `contra`, `desde`, `ante`, `por`, `para`
12. `hasta` — until / up to
    - wrong: `desde`, `hacia`, `entre`, `sobre`, `según`, `tras`
13. `para` — for (purpose) / in order to
    - wrong: `por`, `a`, `hacia`, `hasta`, `sobre`, `según`
14. `por` — by / through / for (cause)
    - wrong: `para`, `a`, `de`, `con`, `según`, `tras`
15. `según` — according to
    - wrong: `entre`, `sobre`, `contra`, `ante`, `bajo`, `tras`
16. `sin` — without
    - wrong: `con`, `en`, `de`, `por`, `sobre`, `entre`
17. `sobre` — on / about
    - wrong: `bajo`, `ante`, `contra`, `según`, `entre`, `tras`
18. `tras` — after / behind
    - wrong: `ante`, `sobre`, `entre`, `contra`, `bajo`, `según`

### CONJUNCIONES

1. `y` — and (becomes `e` before "i" sound)
   - wrong: `o`, `ni`, `pero`, `sino`, `además`, `también`
2. `o` — or (becomes `u` before "o" sound)
   - wrong: `y`, `ni`, `pero`, `sino`, `así que`, `además`
3. `pero` — but
   - wrong: `sino`, `aunque`, `sin embargo`, `no obstante`, `mas`, `mientras`
4. `porque` — because
   - wrong: `pues`, `ya que`, `como`, `puesto que`, `dado que`, `por qué`
5. `si` — if
   - wrong: `cuando`, `aunque`, `como`, `mientras`, `pues`, `porque`
6. `cuando` — when
   - wrong: `mientras`, `si`, `como`, `aunque`, `donde`, `pues`
7. `aunque` — although / even though
   - wrong: `pero`, `sino`, `sin embargo`, `no obstante`, `a pesar de`, `mas`
8. `mientras` — while
   - wrong: `cuando`, `durante`, `si`, `aunque`, `mientras que`, `en cuanto`
9. `como` — as / since / like
   - wrong: `cuando`, `según`, `así como`, `tal como`, `pues`, `ya que`
10. `que` — that
    - wrong: `porque`, `pues`, `si`, `cuando`, `como`, `aunque`
11. `ni` — nor / neither
    - wrong: `y`, `o`, `no`, `tampoco`, `pero`, `sino`
12. `sino` — but rather (after a negative)
    - wrong: `pero`, `mas`, `aunque`, `sin embargo`, `no obstante`, `sino que`
13. `pues` — well / since / because
    - wrong: `porque`, `ya que`, `así que`, `pero`, `entonces`, `conque`
14. `ya que` — since / given that
    - wrong: `porque`, `pues`, `puesto que`, `dado que`, `como`, `así que`
15. `para que` — so that / in order that
    - wrong: `porque`, `a fin de que`, `con tal de que`, `así que`, `ya que`, `de modo que`

### INTERJECCIONES

1. `¡Hola!` — Hi!
   - wrong: `¡Hey!`, `¡Eh!`, `¡Oye!`, `¡Buenas!`, `¡Saludos!`, `¡Buenos días!`
2. `¡Adiós!` — Bye!
   - wrong: `¡Chao!`, `¡Hasta luego!`, `¡Hasta pronto!`, `¡Nos vemos!`, `¡Hasta la vista!`, `¡Hasta mañana!`
3. `¡Ay!` — Ouch! / Oh!
   - wrong: `¡Uf!`, `¡Huy!`, `¡Oh!`, `¡Auch!`, `¡Caramba!`, `¡Vaya!`
4. `¡Uf!` — Phew! / Ugh!
   - wrong: `¡Ay!`, `¡Buf!`, `¡Puf!`, `¡Vaya!`, `¡Huy!`, `¡Bah!`
5. `¡Vaya!` — Wow! / Well!
   - wrong: `¡Caramba!`, `¡Anda!`, `¡Madre mía!`, `¡Hala!`, `¡Dios mío!`, `¡Vale!`
6. `¡Ojalá!` — I hope so! / If only!
   - wrong: `¡Quizá!`, `¡Tal vez!`, `¡Espero!`, `¡Si pudiera!`, `¡Qué bien!`, `¡Mira!`
7. `¡Bah!` — Bah! (dismissive)
   - wrong: `¡Pse!`, `¡Da igual!`, `¡Qué va!`, `¡Pff!`, `¡Buah!`, `¡Nah!`
8. `¡Eh!` — Hey!
   - wrong: `¡Hey!`, `¡Oye!`, `¡Mira!`, `¡Psst!`, `¡Hola!`, `¡Anda!`
9. `¡Huy!` — Oops! / Wow!
   - wrong: `¡Ay!`, `¡Uy!`, `¡Vaya!`, `¡Anda!`, `¡Caramba!`, `¡Ups!`
10. `¡Caramba!` — Wow! / Damn!
    - wrong: `¡Caray!`, `¡Cáspita!`, `¡Madre mía!`, `¡Vaya!`, `¡Anda!`, `¡Diablos!`
11. `¡Dios mío!` — My God!
    - wrong: `¡Madre mía!`, `¡Por Dios!`, `¡Virgen santa!`, `¡Santo cielo!`, `¡Jesús!`, `¡Cielos!`
12. `¡Genial!` — Great! / Awesome!
    - wrong: `¡Bravo!`, `¡Estupendo!`, `¡Fantástico!`, `¡Increíble!`, `¡Magnífico!`, `¡Maravilloso!`
13. `¡Bravo!` — Bravo!
    - wrong: `¡Genial!`, `¡Olé!`, `¡Viva!`, `¡Estupendo!`, `¡Excelente!`, `¡Hurra!`
14. `¡Olé!` — Olé! (cheer)
    - wrong: `¡Bravo!`, `¡Viva!`, `¡Hurra!`, `¡Genial!`, `¡Arriba!`, `¡Ánimo!`
15. `¡Puaj!` — Yuck! / Eww!
    - wrong: `¡Guácala!`, `¡Qué asco!`, `¡Buah!`, `¡Iuh!`, `¡Fuchi!`, `¡Aj!`
16. `¡Madre mía!` — Oh my! / Goodness!
    - wrong: `¡Dios mío!`, `¡Virgen santa!`, `¡Santo cielo!`, `¡Por Dios!`, `¡Cielos!`, `¡Vaya!`
17. `¡Anda!` — Come on! / No way!
    - wrong: `¡Vaya!`, `¡Caramba!`, `¡No me digas!`, `¡Mira!`, `¡Venga!`, `¡Hala!`
18. `¡Salud!` — Cheers! / Bless you!
    - wrong: `¡Chinchín!`, `¡Brindis!`, `¡A tu salud!`, `¡Arriba!`, `¡Ánimo!`, `¡Felicidades!`
19. `¡Chao!` — Bye! (casual)
    - wrong: `¡Adiós!`, `¡Hasta luego!`, `¡Hasta pronto!`, `¡Nos vemos!`, `¡Hasta la vista!`, `¡Hasta mañana!`
20. `¡No me digas!` — You don't say!
    - wrong: `¡Anda!`, `¡Vaya!`, `¡No puede ser!`, `¡En serio!`, `¡De verdad!`, `¡Caramba!`

### PRONOMBRES: PERSONALES

1. `yo` — I
   - wrong: `tú`, `él`, `ella`, `ello`, `usted`, `vos`
2. `tú` — you (informal)
   - wrong: `yo`, `vos`, `usted`, `él`, `ella`, `ti`
3. `vos` — you (informal, used in Argentina/Central America)
   - wrong: `tú`, `usted`, `yo`, `él`, `ella`, `ti`
4. `usted` — you (formal)
   - wrong: `tú`, `vos`, `ustedes`, `él`, `ella`, `yo`
5. `él` — he
   - wrong: `ella`, `ello`, `usted`, `ellos`, `yo`, `vos`
6. `ella` — she
   - wrong: `él`, `ello`, `ellos`, `ellas`, `usted`, `ustedes`
7. `ello` — it (3rd person neuter, refers to a concept/situation)
   - wrong: `él`, `ella`, `esto`, `eso`, `aquello`, `ellos`
8. `nosotros / nosotras` — we (m/f)
   - wrong: `vosotros / vosotras`, `ellos / ellas`, `ustedes`, `nosotros`, `nosotras`, `ellos`
9. `vosotros / vosotras` — you all (informal, Spain)
   - wrong: `nosotros / nosotras`, `ellos / ellas`, `ustedes`, `vosotros`, `vosotras`, `ellos`
10. `ellos / ellas` — they (m/f)
    - wrong: `nosotros / nosotras`, `vosotros / vosotras`, `ustedes`, `ellos`, `ellas`, `ello`
11. `ustedes` — you all (formal / all of LatAm)
    - wrong: `vosotros / vosotras`, `vosotros`, `vosotras`, `nosotros`, `ellos / ellas`, `usted`

### PRONOMBRES: OBJETO

1. `me` — me / myself
   - wrong: `te`, `se`, `nos`, `mí`, `ti`, `le`
2. `te` — you / yourself
   - wrong: `me`, `se`, `os`, `ti`, `le`, `lo`
3. `lo` — him / it (masc.)
   - wrong: `la`, `los`, `las`, `le`, `les`, `se`
4. `la` — her / it (fem.)
   - wrong: `lo`, `las`, `los`, `le`, `les`, `se`
5. `los` — them (masc.)
   - wrong: `las`, `lo`, `la`, `les`, `le`, `se`
6. `las` — them (fem.)
   - wrong: `los`, `lo`, `la`, `les`, `le`, `se`
7. `le` — to him / to her / to you (formal)
   - wrong: `les`, `lo`, `la`, `los`, `las`, `se`
8. `les` — to them / to you all (formal)
   - wrong: `le`, `los`, `las`, `nos`, `se`, `os`
9. `nos` — us / ourselves
   - wrong: `os`, `me`, `se`, `les`, `le`, `te`
10. `os` — you all / yourselves (Spain)
    - wrong: `nos`, `te`, `se`, `les`, `vos`, `me`
11. `se` — himself / herself / themselves / each other
    - wrong: `me`, `te`, `le`, `les`, `sí`, `lo`

### PRONOMBRES: PREPOSICIONALES

These are the distinctive forms used after a preposition. After most prepositions, 1st and 2nd person singular take special forms (`mí`, `ti`); 3rd-person reflexive uses `sí`. With `con`, the comitative forms `conmigo / contigo / consigo` are used. After most prepositions, 3rd-person and plural pronouns reuse the subject forms (`él, ella, ello, usted, nosotros, vosotros, ellos, ellas, ustedes`) and are taught in PERSONALES, not here.

1. `mí` — me (after preposition: *para mí, de mí*)
   - wrong: `ti`, `sí`, `él`, `ella`, `conmigo`, `yo`
2. `ti` — you (after preposition: *para ti, de ti*)
   - wrong: `mí`, `sí`, `tú`, `vos`, `contigo`, `usted`
3. `sí` — himself / herself / themselves (after preposition, reflexive: *piensa en sí mismo*)
   - wrong: `mí`, `ti`, `él`, `ella`, `consigo`, `ello`
4. `conmigo` — with me
   - wrong: `contigo`, `consigo`, `con mí`, `con yo`, `con él`, `con ella`
5. `contigo` — with you
   - wrong: `conmigo`, `consigo`, `con ti`, `con tú`, `con vos`, `con usted`
6. `consigo` — with himself / herself / themselves
   - wrong: `conmigo`, `contigo`, `con sí`, `con él`, `con ella`, `con ello`

### PRONOMBRES: DEMOSTRATIVOS

Three distance levels (this / that-near-you / that-far) plus three neuter forms used to refer to ideas, situations, or unidentified objects. Per the 2010 RAE reform, accents on demonstrative pronouns (éste, ése, aquél) are no longer required; the neuter forms (`esto`, `eso`, `aquello`) never take accents.

1. `este / esta / estos / estas` — this / these
   - wrong: `ese / esa / esos / esas`, `aquel / aquella / aquellos / aquellas`, `esto`, `eso`, `aquello`, `este`
2. `esto` — this (neuter, abstract)
   - wrong: `eso`, `aquello`, `este`, `ese`, `aquel`, `ello`
3. `ese / esa / esos / esas` — that / those (near listener)
   - wrong: `este / esta / estos / estas`, `aquel / aquella / aquellos / aquellas`, `eso`, `esto`, `aquello`, `ese`
4. `eso` — that (neuter, abstract)
   - wrong: `esto`, `aquello`, `ese`, `este`, `aquel`, `ello`
5. `aquel / aquella / aquellos / aquellas` — that / those (far from both)
   - wrong: `este / esta / estos / estas`, `ese / esa / esos / esas`, `aquello`, `eso`, `esto`, `aquel`
6. `aquello` — that (neuter, abstract, far)
   - wrong: `esto`, `eso`, `aquel`, `este`, `ese`, `ello`

### PRONOMBRES: RELATIVOS

Used to introduce subordinate clauses. `cuyo` is technically a relative determiner per modern RAE (NGLE) but is traditionally taught alongside relative pronouns. `donde` doubles as a relative adverb when not introducing a relative clause.

1. `que` — that / which / who
   - wrong: `quien`, `donde`, `cuyo`, `cuando`, `como`, `el cual`
2. `quien / quienes` — who (refers only to people)
   - wrong: `que`, `el cual / la cual / los cuales / las cuales / lo cual`, `cuyo / cuya / cuyos / cuyas`, `donde`, `cuanto / cuanta / cuantos / cuantas`, `quien`
3. `el cual / la cual / los cuales / las cuales / lo cual` — which (formal/emphatic)
   - wrong: `que`, `quien / quienes`, `cuyo / cuya / cuyos / cuyas`, `el que / la que / los que / las que`, `donde`, `cuanto / cuanta / cuantos / cuantas`
4. `cuyo / cuya / cuyos / cuyas` — whose (technically a relative determiner)
   - wrong: `del cual / de la cual / de los cuales / de las cuales`, `de quien / de quienes`, `que`, `quien`, `el cual`, `cuyas`
5. `donde` — where
   - wrong: `cuando`, `como`, `adonde`, `en que`, `en el cual`, `que`
6. `cuanto / cuanta / cuantos / cuantas` — as much / as many as
   - wrong: `cuan`, `como`, `tanto / tanta / tantos / tantas`, `que`, `cuanto`, `lo que`

### PRONOMBRES: INTERROGATIVOS

Used in direct or indirect questions. Always written with an accent in interrogative use to distinguish them from their relative counterparts.

The interrogative adverbs `dónde`, `cómo`, `cuándo`, and `por qué` are intentionally **not** included here — they are adverbs, not pronouns, and belong to the existing `adverbs` word type.

1. `qué` — what
   - wrong: `cuál`, `quién`, `dónde`, `cómo`, `cuándo`, `por qué`
2. `quién / quiénes` — who
   - wrong: `qué`, `cuál / cuáles`, `cuánto / cuánta / cuántos / cuántas`, `dónde`, `cómo`, `quién`
3. `cuál / cuáles` — which
   - wrong: `qué`, `quién / quiénes`, `cuánto / cuánta / cuántos / cuántas`, `cómo`, `dónde`, `cuál`
4. `cuánto / cuánta / cuántos / cuántas` — how much / how many
   - wrong: `qué`, `quién / quiénes`, `cuál / cuáles`, `cuánto`, `cuántos`, `cómo`

### PRONOMBRES: INDEFINIDOS

1. `alguien` — someone
   - wrong: `nadie`, `alguno`, `algo`, `cualquiera`, `uno`, `todos`
2. `nadie` — no one
   - wrong: `alguien`, `ninguno`, `ninguna`, `nada`, `ningún`, `ninguno / ninguna`
3. `algo` — something
   - wrong: `alguien`, `nada`, `algún`, `alguno`, `cualquier cosa`, `todo`
4. `nada` — nothing
   - wrong: `algo`, `nadie`, `ningún`, `ninguno`, `ninguna cosa`, `todo`
5. `alguno / alguna / algunos / algunas` — some / any
   - wrong: `ninguno / ninguna`, `otro / otra / otros / otras`, `cualquiera`, `todos`, `varios`, `algún / alguna`
6. `ninguno / ninguna` — none / not any
   - wrong: `alguno / alguna / algunos / algunas`, `nadie`, `nada`, `ningún`, `ninguno`, `ningunos`
7. `todo / toda / todos / todas` — all / everyone / everything
   - wrong: `alguno / alguna / algunos / algunas`, `otro / otra / otros / otras`, `todos`, `todas`, `cada`, `ambos`
8. `otro / otra / otros / otras` — other / another
   - wrong: `alguno / alguna / algunos / algunas`, `mismo / misma / mismos / mismas`, `todo / toda / todos / todas`, `otros`, `otra`, `demás`
9. `mucho / poco / varios / cualquiera` — much / few / several / anyone
   - wrong: `alguno / alguna / algunos / algunas`, `todo / toda / todos / todas`, `otro / otra / otros / otras`, `bastante / demasiado`, `tanto / tanta / tantos / tantas`, `ambos`
10. `uno / una` — one (impersonal "one")
    - wrong: `otro / otra`, `alguno / alguna`, `ninguno / ninguna`, `unos / unas`, `uno`, `cualquiera`

### Wrong Answer Requirements

Wrong answers MUST match the existing app patterns:

- **Exactly 6 wrong answers per word** (`WRONG_ANSWER_COUNT = 6`)
- Wrong answers must be **unique** (no duplicates after normalization)
- Wrong answers must **not match the correct answer** after normalization
- Each wrong answer must be **1–96 characters** (`THEME_WRONG_ANSWER_INPUT_MAX_LENGTH`)
- Wrong answers should be **plausible alternatives from the same word category** (e.g., for a preposition, wrong answers are other prepositions or similar-sounding Spanish words)
- Wrong answers should use **similar-sounding words, subtle meaning differences, or common learner mistakes** — same strategy as existing word types
- No `(Irr)` markers on wrong answers
- For categories with fewer than 7 items in the same group (e.g., some pronoun sub-categories), wrong answers can pull from related sub-categories or include plausible Spanish words that a learner might confuse

## Locked Theme Behavior

These pre-generated grammar themes are not normal editable user themes. They are user-visible study content copied into each account, but they are locked system-provided content for now.

Users must not be able to:

- Edit the theme name, description, words, answers, or wrong answers
- Add generated or manual words
- Regenerate fields or regenerate answers for edited words
- Generate random words into the theme
- Delete the theme
- Change visibility or friend-edit permissions
- Generate TTS for the theme
- Duplicate the locked theme into an editable copy unless that is intentionally added later

Locked grammar themes ARE archivable like any other theme. Archiving only hides the theme from the active list; it does not modify the theme itself, so it remains compatible with the lock.

The UI should make this clear by hiding or disabling edit-only controls when a theme is locked. Backend mutations must still enforce the lock so locked themes cannot be modified by direct API calls.

Implementation should centralize the lock checks instead of scattering string comparisons across the app. Add shared helpers such as:

- `isPreGeneratedGrammarTheme(theme)`
- `assertThemeNotLocked(theme)`

Use these helpers anywhere a theme can be edited, deleted, duplicated, archived, shared, patched with generated TTS, or treated as editable.

## Schema Changes

### `convex/schema.ts`

Extend `wordTypeValidator` to include the 4 new types:

```ts
export const wordTypeValidator = v.union(
  v.literal("nouns"),
  v.literal("verbs"),
  v.literal("adjectives"),
  v.literal("adverbs"),
  v.literal("prepositions"),
  v.literal("conjunctions"),
  v.literal("interjections"),
  v.literal("pronouns")
);
```

Add a way to identify locked pre-generated grammar themes. For example:

```ts
const themeSourceValidator = v.union(
  v.literal("user"),
  v.literal("pre_generated_grammar")
);
```

Add `source: v.optional(themeSourceValidator)` to `themes`.

Existing/user-created themes should behave as `source: "user"` or undefined. Seeded grammar themes should be inserted with `source: "pre_generated_grammar"`.

### `lib/themes/wordTypes.ts`

Split word type handling into two concepts:

1. **Persisted/displayable word types** — all word types that can exist on saved themes. Use a distinct TypeScript type such as `DisplayWordType`:
   - `nouns`
   - `verbs`
   - `adjectives`
   - `adverbs`
   - `prepositions`
   - `conjunctions`
   - `interjections`
   - `pronouns`

2. **AI-generatable word types** — only the types supported by the LLM generation flow. Use a distinct TypeScript type such as `GeneratableWordType`:
   - `nouns`
   - `verbs`
   - `adjectives`
   - `adverbs`

The 4 new grammar types should have display labels, but they should not be included in the generate carousel or accepted by generation API validation.

Do **not** add incomplete entries to `WORD_TYPE_CONFIG` if that config is still used by prompt generation, because generation code expects full prompt fields for every config entry.

Prompt-generation code should accept `GeneratableWordType`, not the broader persisted/displayable type.

### `lib/themes/constants.ts`

Increase `THEME_NAME_MAX_LENGTH` from `25` to `35`.

Also fix the existing wrong-answer count oversight:

- `THEME_MIN_WRONG_ANSWER_COUNT` should be `6`
- `THEME_MAX_WRONG_ANSWER_COUNT` should remain `6`

The app should treat 6 wrong answers as the only valid count.

### Generation boundaries

Keep the new grammar word types out of all AI generation surfaces:

- `GenerateThemeModal` should only show generatable word types.
- `/api/generate` request validation should reject non-generatable word types.
- Add-word, regenerate-field, regenerate-for-word, and generate-random flows should not be available on locked grammar themes.

Because these themes are hard-locked, also block manual editing paths, not just AI generation paths.

### Locked theme access and UI boundaries

Current owner/editor logic treats owners as editable by default. Update that behavior so locked grammar themes return `canEdit: false` even for owners.

Apply the locked-theme behavior in these visible surfaces:

- Theme detail should render locked grammar themes as read-only.
- Theme name, word cards, add-word, random generation, regeneration, save, visibility, friend-edit, and TTS controls should be hidden or disabled.
- `ThemeCardMenu` should hide or disable duplicate and delete controls for locked grammar themes. The archive control should remain enabled.
- Theme list TTS status should not show locked grammar themes as broken just because seeded TTS is intentionally absent. Hide the TTS badge for locked grammar themes or show a neutral locked/read-only status.

Apply the locked-theme behavior in backend boundaries:

- `requireThemeEditor` should reject locked grammar themes.
- Owner-only mutations still need explicit lock checks, because ownership alone should not permit changing locked themes.
- `generateThemeTTS` should reject locked grammar themes before spending credits or generating audio.
- `applyGeneratedThemeTts` should avoid patching locked grammar themes, even if called internally with stale/generated data.
- `toggleThemeArchive` should accept locked grammar themes; archiving does not violate the lock.

## Seeding Implementation

### Theme data file

Create `lib/themes/preGeneratedThemes.ts` containing all 10 themes with their complete word data (including exactly 6 wrong answers per word). This is the single source of truth for the seeded content.

Seed data must pass the same normalization and validation rules as user-created themes:

- `normalizeThemeName`
- `normalizeThemeDescription`
- `normalizeThemeWords`
- wrong-answer count exactly 6
- no duplicate wrong answers after normalization
- no wrong answer matching the correct answer after normalization
- names must fit the new 35-character limit

Use stable seed keys for idempotency, for example:

- `pre-generated-grammar:prepositions`
- `pre-generated-grammar:conjunctions`
- `pre-generated-grammar:interjections`
- `pre-generated-grammar:pronouns-personal`
- `pre-generated-grammar:pronouns-object`
- `pre-generated-grammar:pronouns-prepositional`
- `pre-generated-grammar:pronouns-demonstrative`
- `pre-generated-grammar:pronouns-relative`
- `pre-generated-grammar:pronouns-interrogative`
- `pre-generated-grammar:pronouns-indefinite`

### Migration script (existing users)

Create an internal Convex helper plus an admin/internal migration entry point that:
1. Queries all users
2. For each user, inserts any missing seeded themes with `ownerId` set to that user
3. Uses stable `saveRequestId` values and the existing `by_owner_save_request` index to avoid duplicates
4. Sets `visibility: "private"`, `friendsCanEdit: false`, `source: "pre_generated_grammar"`, and `createdAt: Date.now()`

The shared helper should be something like `seedPreGeneratedGrammarThemesForUser(ctx, userId)` and should be reusable from both the migration and new-user signup.

Run the migration in batches/paginated chunks rather than one unbounded mutation that processes every user at once.

### New user signup

Modify the user creation flow in `convex/users.ts` / `syncUser` to call the shared seeding helper after creating the user record. This inserts the same 10 themes into the new user's account.

Do not call a separate exported mutation from `syncUser`; keep this inside the same Convex mutation transaction via the shared helper.

## Files to Create/Modify

### Create
- `lib/themes/preGeneratedThemes.ts` — theme data with all words and wrong answers

### Modify
- `convex/schema.ts` — extend `wordTypeValidator`
- `lib/themes/wordTypes.ts` — split persisted/displayable word types from AI-generatable word types
- `lib/themes/constants.ts` — increase theme name max length to 35 and enforce exactly 6 wrong answers
- Add a shared locked-theme helper module or helper functions near theme permissions/access logic
- `lib/generate/requestValidation.ts` — reject non-generatable word types
- `app/themes/components/GenerateThemeModal.tsx` or exported constants it consumes — show only generatable word types
- Theme list/menu/detail/edit UI — render locked grammar themes as read-only and hide/disable edit, add, delete, share, duplicate, random generation, regeneration, and TTS controls; keep archive enabled
- Theme mutations/actions — reject update, delete, visibility/friend-edit changes, duplicate, generated-word insertion, regeneration, and TTS changes for `source: "pre_generated_grammar"` themes; allow archive
- `convex/themes.ts` or new `convex/seedThemes.ts` — shared idempotent seeding helper plus migration entry point
- User creation flow (wherever new users are created) — call seeding after signup

## Test Plan

Add or update tests for the behavior changes:

- `lib/themes/wordTypes` tests:
  - Persisted/displayable types include all 8 word types.
  - AI-generatable types include only nouns, verbs, adjectives, and adverbs.
  - Prompt-generation helpers only accept/use AI-generatable types.
- Generate API validation tests:
  - `/api/generate` rejects `prepositions`, `conjunctions`, `interjections`, and `pronouns` for theme generation, add-word, regenerate-field, regenerate-for-word, and generate-random requests.
  - Existing supported word types still pass.
- Theme validation/constants tests:
  - Theme names up to 35 characters are accepted.
  - Wrong-answer count must be exactly 6.
- Seed data tests:
  - All 10 pre-generated themes pass `normalizeThemeName`, `normalizeThemeDescription`, and `normalizeThemeWords`.
  - Every word has exactly 6 wrong answers.
  - Wrong answers are unique after normalization and do not match the correct answer.
  - Theme names fit the 35-character limit.
- Convex/backend tests:
  - Seeding inserts the 10 themes for a user.
  - Seeding is idempotent using stable `saveRequestId` values.
  - New-user sync seeds the themes after user creation.
  - Locked grammar themes reject update, delete, duplicate, visibility, friend-edit, and TTS mutations/actions.
  - Locked grammar themes accept archive/unarchive.
  - `canEdit` is false for locked grammar themes, including for the owner.
- UI tests:
  - `GenerateThemeModal` only shows AI-generatable word types.
  - Locked theme detail hides or disables edit/add/random/regenerate/save/share/TTS controls.
  - Theme card menu hides or disables duplicate/delete for locked grammar themes, while keeping archive enabled.
  - Theme list does not show locked grammar themes as missing TTS.

## Out of Scope

- LLM generation support for new word types
- TTS pre-generation
- Making locked grammar themes editable, deletable, shareable, duplicable, or extendable
- Visual badges beyond whatever minimal locked/read-only UI is needed
- `WORD_TYPE_CONFIG` generation prompt rules for new types

## TODO: Revisit Before Unfreezing

Feature is frozen for now. User interview feedback was strongly negative: this pre-generated grammar theme direction was disliked, so do not implement until the product value and user experience are revalidated.

Review notes to address if this is revived later:

- Current app expects `word = English cue`, `answer = Spanish correct answer`, and `wrongAnswers = Spanish distractors`. This plan's data currently reads like `word = Spanish`, `answer = English`, and `wrongAnswers = Spanish`, which would break multiple choice by mixing English correct answers with Spanish distractors.
- Locked-theme checks must cover owner-only mutations too, not just `requireThemeEditor`: `updateThemeVisibility`, `updateThemeFriendsCanEdit`, `deleteTheme`, and `duplicateTheme`.
- `duplicateTheme` currently lacks a proper access check beyond theme existence; fix that generally if touching duplication.
- Clarify TTS scope: blocking `generateThemeTTS` only blocks stored theme TTS, while live playback can still call `/api/tts/route.ts` through `app/game/hooks/useTTS.ts`.
- Theme UI owner controls need lock awareness: `ThemeDetail.tsx` owner visibility/friend-edit controls, `ThemeCardMenu.tsx` duplicate/delete controls, and `ThemeList.tsx` TTS-missing badge.
- Overview says pronouns are split into 6 sub-themes, but the plan lists 7 pronoun sub-themes.