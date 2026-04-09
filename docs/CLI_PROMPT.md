# Flow QA CLI — LLM prompt contract

The `flow-qa generate` command (`src/cli/generate.ts`) calls the model with:

1. **System role** — Infer **testable hypotheses** and **jobs-to-be-done** from routes; output **valid JSON only** with `bundle` + `strategic_observations`.
2. **User payload** — `routes.json` contents: `{ path, file }[]`.
3. **Output shape**
   - `bundle`: `{ version: 1, flows: Flow[], steps: Record<string, Step> }` with strategic fields on flows/steps where inferable.
   - `strategic_observations`: 5–15 items when possible; prefer **specific, falsifiable** statements; flag **gaps** (data without UI) and **inconsistent implementations**.

## Post-processing

- Strip markdown fences if the model wraps JSON in ` ```json ` blocks (`extractJsonBlock`).
- On failure or missing `OPENAI_API_KEY`, fall back to **stub** flows + observations so the pipeline is always exercisable.
