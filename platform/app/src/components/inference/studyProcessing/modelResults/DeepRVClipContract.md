# DeepRV-CLIP Worklist Result Contract

- Canonical model name: `DeepRV-CLIP`
- Supported model version: `1.0.0`
- Result source: the completed study-service job `result_json`

The dedicated renderer accepts the JSON result produced by the deployed model in JSON output mode:

```json
{
  "diagnosis": "DeepRV-CLIP: Normal RV systolic function (P=0.12)",
  "predictions": {
    "abnormalRV": {
      "probability": 0.12,
      "threshold": 0.5,
      "diagnosis": "normal"
    }
  },
  "modelRecommendations": {
    "en": "...",
    "fr": "...",
    "presentable": true
  }
}
```

Both probability values must be finite numbers between `0` and `1`, inclusive. The prediction diagnosis must be `normal` or `abnormal`. Model-authored diagnosis and recommendation strings are retained in the validated payload but are not rendered as trusted markup.

An unsupported version or invalid payload uses the generic result renderer.
