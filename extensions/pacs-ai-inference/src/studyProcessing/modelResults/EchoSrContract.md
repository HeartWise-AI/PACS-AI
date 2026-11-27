# Echo measurements (SR) result contract

`echo-sr-measurements` is not a model. study-service (cardio-agent `study-service/src/services/echo_sr.py`)
reads the sonographer's measurements from the echo DICOM SR (Adult Echocardiography Procedure Report, TID 5200;
GE Vivid, Philips EPIQ) and stores them as a pipeline job like a model result. It has no api-pacs registration
and no HTML report, so the viewer:

- lists it in the AI menu as its own row ("Echo measurements (SR)" / "Mesures écho (SR)");
- loads its JSON with `GET /v1/inference/worklist/studies/{uid}/jobs/{studyServiceJobId}/result`
  (data: `studyServiceJobId, studyInstanceUID, modelName, modelVersion, status, completedAt, result`);
  403/404/405/501 keep the "details not available" state;
- shows its key values first in the PanEcho and EchoPrime drawers of the same study.

## Identity and versions

- Model name: `echo-sr-measurements`; versions `1.0.x`; schema `echo-sr-measurements/1`.

## Payload

```json
{
  "schema": "echo-sr-measurements/1",
  "source": { "kind": "dicom-sr", "srCount": 1, "documents": [{ "manufacturer": "...", "model": "...", "template": "5200", "measurementCount": 50 }] },
  "measurements": [{ "site": "Aortic Valve", "measurement": "Peak Velocity", "value": 4.31, "unit": "m/s", "mode": "Doppler Continuous Wave", "flowDirection": "Antegrade Flow", "samples": 3, "rule": "chosen, max" }],
  "summary": { "avVmax": { "value": 4.31, "unit": "m/s", "mode": "...", "site": "Aortic Valve", "rule": "chosen, max" }, "lvef": { "value": 55, "unit": "%", "method": "Method of Disks, Biplane", "otherMethods": [{ "method": "Teichholz", "value": 62 }] } },
  "asGrading": { "grade": "severe", "label": "Severe AS (measured)", "labelFr": "...", "basis": ["AV Vmax 4.31 m/s"], "derivedFrom": "measurements", "guideline": "...", "note": "...", "ava": { "value": 0.71, "unit": "cm2" }, "avaNote": "AVA 0.71 cm2 < 1.0 cm2", "discordant": false },
  "diagnosis": { "AV peak velocity (Vmax)": "4.31 m/s" },
  "rules": { "repeated": "...", "units": "...", "asGrading": "..." }
}
```

Summary keys: `avVmax, avMeanGradient, avPeakGradient, avVti, ava, avaVti, avaVmax, avaPlanimetry, lvotDiameter,
lvotVti, lvotVmax, lvef, trPeakGradient, trVmax, mvE, mvA, mvEA, ePrimeSeptal, ePrimeLateral, eOverEPrime, tapse`;
each is optional. `asGrading` is null without an aortic valve Doppler value. Grades: `severe, moderate, mild, none,
none_or_mild`. Units: velocity m/s (tissue Doppler cm/s), length cm, area cm2, volume ml, pressure mmHg.

The AS grading is derived from the measured values by guideline thresholds (Vmax >= 4 m/s or mean gradient >= 40
mmHg = severe; AVA < 1.0 cm2 noted, flagged discordant when the gradients are not severe). It is labelled as derived
from the measurements, never as a physician read.

All fixtures are synthetic and contain no patient or study identifiers.
