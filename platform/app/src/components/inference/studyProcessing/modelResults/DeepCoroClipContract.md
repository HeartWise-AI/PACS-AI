# DeepCORO-CLIP result presentation contract

## Approved scope

- Priority model: `DeepCoro_CLIP_generic`
- First supported execution model version: `1.0.0`
- Deployed image family: `heartwisehub/pacs-ai-deepcoro-clip-generic:1.0`
- Transport: the existing tenant-scoped execution-result endpoint from issues #392 and #393
- Fallback: the generic structured result viewer remains authoritative when this contract does not validate

## Observed deployed JSON structure

Only aggregate model/version/status counts and JSON key names/types were inspected on 2026-08-16.
No patient identifiers, study identifiers, result values, or source payloads were copied into this
repository. The deployed service reports completed results under canonical model
`DeepCoro_CLIP_generic` and version `1.0.0`.

Every supported payload contains:

| Path | Type | Documented range or values | Required for custom rendering |
| --- | --- | --- | --- |
| `diagnosis` | string | model-authored text | yes |
| `predictions.<artery>.regression` | finite number | 0–100 | yes |
| `predictions.<artery>.stenosis_prob` | finite number | 0–1 | yes |
| `predictions.<artery>.diagnosis_stenosis` | string | `normal`, `blocked` | yes |
| `predictions.<artery>.calcif_prob` | finite number | 0–1 | yes |
| `predictions.<artery>.diagnosis_calcif` | string | `normal`, `calcified` | yes |
| `predictions.<artery>.cto_prob` | finite number | 0–1 | yes |
| `predictions.<artery>.diagnosis_cto` | string | `normal`, `cto` | yes |
| `predictions.<artery>.thrombus_prob` | finite number | 0–1 | yes |
| `predictions.<artery>.diagnosis_thrombus` | string | `normal`, `thrombus` | yes |
| `modelRecommendations.en` | string | model-authored text | yes |
| `modelRecommendations.fr` | string | model-authored text | yes |
| `modelRecommendations.presentable` | boolean | presentation metadata | yes |

The deployed payload exposes 18 model-defined artery keys, grouped by the model implementation:

- RCA: Proximal RCA, Mid RCA, Distal RCA, Posterior Descending Artery, Posterolateral Branch.
- LCA: Left Main Branch, Proximal/Mid/Distal LAD, D1/D2 Branch, Proximal/Mid/Distal LCX,
  OM1, and OM2.
- Other: Branch Vessel and LVp.

The model implementation applies artery-specific thresholds to the probability outputs. Those
threshold values are model implementation details and are not reproduced or reinterpreted by the
frontend. The frontend contract validates the model-provided categorical diagnoses without trying
to recalculate them.

## Pending clinical and product approval

Before the DeepCORO-CLIP presentation is considered clinically approved, stakeholders must confirm:

- English and French artery labels and group names;
- whether to show all arteries or only findings classified as non-normal;
- whether `regression` should be labelled as an estimated stenosis percentage;
- probability formatting and precision;
- whether model-provided categorical diagnoses may drive visual emphasis;
- whether model-generated diagnosis and recommendation strings may be displayed;
- the exact assistive-AI disclaimer and model/version context.

Until those decisions are recorded, the renderer must not invent thresholds, recommendations, or
clinical interpretations. Model-provided HTML is never supported.

## Review template implemented in PR #414

The review template intentionally:

- shows all 18 documented arteries in RCA, LCA, and Other groups;
- formats the 0–100 stenosis estimate and 0–1 probabilities as one-decimal percentages;
- displays the model-provided categorical diagnoses without recalculating thresholds;
- uses neutral table styling rather than threshold-derived clinical colours;
- omits the model-authored diagnosis and recommendation prose;
- includes an assistive-AI note and semantic table markup.

These presentation choices remain subject to the stakeholder approval listed above.
