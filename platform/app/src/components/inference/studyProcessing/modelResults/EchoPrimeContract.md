# EchoPrime result contract

PACS-342 verified the frontend contract against the EchoPrime 1.2 JSON inference implementation, phenotype definition, and ROC threshold table.

## Identity and version

- Canonical model name: `EchoPrime`
- Supported model version: `1.2.0`

## Payload

```json
{
  "diagnosis": "Left Ventricle: ...[SEP]Right Ventricle: ...[SEP]",
  "predictions": {
    "ejection_fraction": 59.0,
    "pulmonary_artery_pressure_continuous": 22.5,
    "mitral_regurgitation": 0.08
  },
  "modelRecommendations": {
    "en": null,
    "fr": null,
    "presentable": true
  }
}
```

`diagnosis` is a generated report whose sections are separated by `[SEP]`. Predictions include continuous measurements (ejection fraction in percent and pulmonary artery systolic pressure in mmHg), binary finding probabilities, and potentially new phenotype keys. Binary classifications use the model package's versioned ROC thresholds.

The frontend treats the report, recommendations, individual prediction values, nulls, and unfamiliar keys as optional. An object with a `predictions` object is renderable even when partial or empty. A non-object payload or a payload without a predictions object uses the explicit unsupported-payload fallback and retains raw result access.

All fixtures are synthetic and contain no patient or study identifiers.
