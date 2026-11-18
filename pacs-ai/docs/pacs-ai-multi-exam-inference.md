# AI inference with multiple exams

The AI series picker offers an Exam selector labelled with each loaded exam's date and description. Choose the exam first, then select its series and apply the model. Each request targets one exam. Switching exams clears selected series; selecting or deselecting all series keeps the chosen exam. The first-X control and model maximum apply within the chosen exam.

Primary exams are listed first. Comparison exams displayed in a viewport are included even when absent from the primary viewer URL. Automatically loaded patient priors are not sufficient to make an exam an inference target. An exam must have loaded display sets to appear. This change does not submit inference automatically or combine exams.

## Eligible series

The picker excludes series labelled RAPPORT, REPORT, or PDF (case insensitive), structured-report/document modalities, and PDF or structured-report SOP classes. Known single-frame and empty display sets are excluded from the rows, available count, and first-X/bulk selections. Model modality restrictions still apply.

Frame eligibility uses `numImageFrames`/`NumberOfFrames` and the multi-frame flag. A DICOM instance can contain an entire cine, so one instance does not imply one frame. The study-browser projection preserves frame count and SOP class metadata for this check. When frame metadata is unavailable, the picker keeps the series rather than guessing. Changing eligibility removes stale selected series before submission.

## Shared state contract

`selectedModalities` remains keyed by modality because both AIModelButton implementations filter available models using those keys. `buildInferenceStudyModalities` appends series for exams sharing a modality, retaining each series' StudyInstanceUID, exam date, and description. Never key this map by study UID without updating every consumer.

The picker groups the series by StudyInstanceUID, filters the visible list and bulk selection to the selected exam, and validates the submitted series against it. Initial selections for a non-first exam must survive initialization.

## Regression and review

An initial deployment changed modality keys to study UIDs. Both AI model menus compared those keys with supported modalities and hid all models. The correction preserves modality keys and appends series instead of overwriting the previous exam. An independent Astra high review also identified initial-selection loss for a non-first exam and an unintended exam switch when clearing bulk selection; both have regression coverage.

## Validation before rollout

Run the focused tests:

```sh
yarn jest --config platform/app/jest.config.js --runInBand SelectSeriesModal.test.tsx buildInferenceStudyModalities.test.ts isInferenceSeriesEligible.test.ts
```

In an authenticated viewer, open two exams sharing a modality. Verify supported AI models remain visible. Check exam dates and series lists against the viewer. Select the second exam, select all, clear all, and confirm it remains selected. Switch exams and confirm selected series clear. Run an intended test inference and confirm the request's StudyInstanceUID and series belong to the chosen exam. Check a loaded comparison exam absent from primary URL parameters as well. Confirm RAPPORT/PDF and single-frame items are absent while one-instance multi-frame cine remains available, including when using Select first or Select all.

Build and serving checks alone do not validate an authenticated patient session. Do not record patient identifiers, DICOM identifiers, tokens, or inference payloads in rollout evidence.

## Deployment and rollback

Build a distinct frontend image; preserve production runtime configuration. Keep the prior container and snapshot until validation succeeds. Verify HTTPS index and new bundle delivery, selector and validation strings in that bundle, and backend availability. If model visibility or exam identity checks fail, restore the prior known-good frontend. Keep fixes in source and deployment checkout synchronized.
