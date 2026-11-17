# PanEcho result contract

PACS-342 verified the frontend contract against the PanEcho JSON inference implementation and its `output_class_mapping.json`.

## Identity and versions

- Canonical model name: `PanEcho`
- Supported model versions: `1.0.0`, `1.4.0`
- `1.0.0` is declared by the model package; `1.4.0` is also emitted by the current frontend worklist fixture and uses the same result shape.

## Payload

```json
{
  "diagnosis": "{\"Left ventricular (LV) ejection fraction\":\"58.4 % (Normal)\"}",
  "predictions": {
    "Left ventricular (LV) ejection fraction": 58.4,
    "LV systolic function": [0.03, 0.08, 0.89]
  },
  "modelRecommendations": {
    "en": "...",
    "fr": "...",
    "presentable": true
  }
}
```

`diagnosis` is a JSON-serialized map of display labels to model classifications or interpreted measurements. `predictions` is a map keyed by the same display labels. Regression heads contain finite numbers; multiclass heads may contain numeric arrays; some classification heads may appear only in the diagnosis map.

The frontend treats diagnosis, recommendations, individual predictions, and unfamiliar output keys as optional. An object with a `predictions` object is renderable even when partial or empty. A non-object payload or a payload without a predictions object uses the explicit unsupported-payload fallback and retains raw result access.

All fixtures are synthetic and contain no patient or study identifiers.
