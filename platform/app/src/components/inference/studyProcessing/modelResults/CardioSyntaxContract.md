# CardioSyntax result presentation contract

## Approved scope

- Priority model: `CardioSyntax`
- First supported execution model version: `1.0.0`
- Transport: the existing tenant-scoped execution-result endpoint from issues #392 and #393
- Fallback: the generic structured result viewer remains authoritative when this contract does not validate

## Observed deployed JSON structure

Only aggregate key names and JSON types were inspected on 2026-08-16. No patient identifiers,
study identifiers, result values, or source payloads were copied into this repository.

| Path | Type | Required for custom rendering |
| --- | --- | --- |
| `diagnosis` | string | yes |
| `predictions.Global Cardiac Syntax.regression` | finite number | yes |
| `predictions.Global Cardiac Syntax.category` | category string | yes |
| `predictions.Left Cardiac Syntax.regression` | finite number | yes |
| `predictions.Left Cardiac Syntax.category` | category string | yes |
| `predictions.Right Cardiac Syntax.regression` | finite number | yes |
| `predictions.Right Cardiac Syntax.category` | category string | yes |
| `modelRecommendations.en` | string | yes |
| `modelRecommendations.fr` | string | yes |
| `modelRecommendations.presentable` | boolean | yes |

The model implementation documents the category keys `no_disease`, `mild`, `moderate`, and
`severe` and an AI-predicted score range of 0–100. Completed payloads with out-of-range scores or
missing territory predictions do not qualify for the custom renderer and must fall back safely.

## Pending clinical and product approval

The structural contract does not approve presentation semantics. Before the CardioSyntax UI is
finalized, stakeholders must approve:

- clinician-facing territory and category labels in English and French;
- whether all three territory scores should be shown;
- the score unit or explicit statement that the value is unitless;
- numeric precision and any range validation;
- threshold text and whether threshold-based colours are appropriate;
- whether model-generated diagnosis and recommendation strings may be displayed;
- the exact assistive-AI disclaimer and any model/version context required beside it.

Until those decisions are recorded, the renderer must not invent units, thresholds, colours,
recommendations, or clinical interpretations. Model-provided HTML is never supported.
