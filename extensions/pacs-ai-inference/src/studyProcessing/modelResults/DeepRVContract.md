# DeepRV Worklist Result Contract

- Canonical model name: `DeepRV`
- Supported model version: `1.0.0`
- Result source: the completed study-service job `result_json`

The dedicated renderer accepts the JSON result produced by the deployed model in JSON output mode:

```json
{
  "diagnosis": "Normal right ventricular function",
  "predictions": {
    "probability": 0.18,
    "class": 0
  },
  "modelRecommendations": {
    "en": "...",
    "fr": "...",
    "presentable": true
  }
}
```

`probability` must be a finite number between `0` and `1`, inclusive. The deployed legacy contract uses numeric classes: `0` for normal RV function and `1` for reduced RV function. Model-authored diagnosis and recommendation strings are retained in the validated payload but are not rendered as trusted markup.

An unsupported version or invalid payload uses the generic result renderer.
