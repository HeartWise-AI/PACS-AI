# OHIF 3.12.18 overlap validation map

This map covers every file changed by both PACS-AI and official OHIF between the verified
`v3.11.1` base and the `v3.12.18` target. It is the validation inventory for issue #458.

## Pre-integration evidence

- Verified base: `v3.11.1` / `3c2b027e8bc7a238ffe46ecb5f57c6c913069c3e`.
- Frozen PACS-AI source before integration: `86751e2d05badb29df962613d862e496d5f32d53`.
- PACS characterization commit: `6937b4571` (`test: characterize PACS contracts before OHIF 3.12`).
- PACS test result: 141/141 suites and 979/979 tests passed.
- Official target: `v3.12.18` / `f9599110d4b0bdab27026eb49d1c2daeb5284a94`.
- Path-accurate overlap: 92 paths; rename-aware explicit-base conflicts: 41 paths.
- Official target build: passed with Webpack 5.105.0.
- Official target unit result: 69/69 suites and 869/869 tests passed.
- Official Playwright discovery: 78 tests in 60 files listed successfully with `OHIF_OPEN=false`.

No OHIF 3.12 application source had been integrated when these results were captured.

## Validation codes

- **PACS-UNIT**: a PACS product contract is protected by a unit/component test on the frozen baseline.
- **OHIF-UNIT**: the official target unit suite supplies relevant regression protection.
- **BROWSER**: Playwright/Cypress or authenticated integration validation is the appropriate contract.
- **VISUAL**: a human must confirm rendering, layout, styling, or clinical interaction behavior.
- **BUILD**: frozen installation, compilation, packaging, or container validation is the contract.
- **REVIEW**: deterministic three-way review is appropriate for documentation or generated metadata.
- **I18N**: key-presence review plus localized UI smoke validation is required.

`BROWSER`, `VISUAL`, and authenticated workflow checks are intentionally deferred to the relevant
stories #459-#463. They are not represented as unit coverage.

## All 92 overlapping paths

The comparison uses `--no-renames` for path accounting. This prevents Git from hiding an old path
when one side modifies it and the other side renames or deletes it. Rename-aware merge simulation
is still used separately to predict actual conflicts.

| # | Overlapping file | Primary validation |
|---:|---|---|
| 1 | `.netlify/build-deploy-preview.sh` | BUILD: deploy-preview command and artifact check |
| 2 | `.webpack/webpack.base.js` | BUILD: development and production compilation |
| 3 | `README.md` | REVIEW: accept current project documentation and manually reconcile upstream instructions |
| 4 | `addOns/externals/devDependencies/package.json` | BUILD: frozen workspace installation and add-on build |
| 5 | `commit.txt` | REVIEW: regenerate from the accepted target identity |
| 6 | `extensions/cornerstone/src/Viewport/Overlays/CustomizableViewportOverlay.tsx` | BROWSER + VISUAL: axial/MPR overlay content and placement |
| 7 | `extensions/cornerstone/src/components/DicomUpload/DicomUpload.css` | BROWSER + VISUAL: upload dialog layout |
| 8 | `extensions/cornerstone/src/components/DicomUpload/DicomUploadProgress.tsx` | BROWSER: upload progress, cancel, completion, and failure behavior |
| 9 | `extensions/cornerstone/src/components/WindowLevelActionMenu/Colorbar.tsx` | BROWSER + VISUAL: colorbar interaction |
| 10 | `extensions/cornerstone/src/components/WindowLevelActionMenu/Colormap.tsx` | BROWSER + VISUAL: colormap selection and rendering |
| 11 | `extensions/cornerstone/src/components/WindowLevelActionMenu/VolumeRenderingOptions.tsx` | BROWSER + VISUAL: volume-rendering controls |
| 12 | `extensions/cornerstone/src/init.tsx` | OHIF-UNIT + BROWSER: Cornerstone initialization and viewer smoke matrix |
| 13 | `extensions/default/src/DicomTagBrowser/DicomTagBrowser.tsx` | BROWSER: official `tests/DicomTagBrowser.spec.ts` |
| 14 | `extensions/default/src/DicomWebDataSource/index.ts` | PACS-UNIT: session-token precedence and auth fallback; add integrated OHIF transfer-syntax assertions |
| 15 | `extensions/default/src/Panels/StudyBrowser/PanelStudyBrowser.tsx` | PACS-UNIT: eager display-set creation; BROWSER for thumbnails and navigation |
| 16 | `extensions/default/src/Panels/StudyBrowser/PanelStudyBrowserHeader.tsx` | BROWSER + VISUAL: Study Browser controls and presets |
| 17 | `extensions/default/src/Toolbar/ToolbarLayoutSelector.tsx` | OHIF-UNIT (`useToolbar`) + BROWSER + VISUAL |
| 18 | `extensions/default/src/utils/Toolbox.tsx` | OHIF-UNIT (`useToolbar`) + BROWSER: active-tool and toolbar-section behavior |
| 19 | `extensions/dicom-microscopy/src/services/MicroscopyService.ts` | BROWSER + VISUAL: microscopy dataset load and navigation |
| 20 | `extensions/tmtv/src/Panels/PanelROIThresholdSegmentation/ROIThresholdConfiguration.tsx` | BROWSER: official TMTV suite + VISUAL |
| 21 | `modes/segmentation/.webpack/webpack.prod.js` | BUILD: segmentation production bundle |
| 22 | `package.json` | BUILD: frozen installation, scripts, resolved dependency versions, and production build |
| 23 | `platform/app/.recipes/Nginx-Dcm4chee-Keycloak/dockerfile` | BUILD: Dcm4chee/Keycloak image and startup smoke |
| 24 | `platform/app/.recipes/Nginx-Dcm4chee/dockerfile` | BUILD: Dcm4chee image and startup smoke |
| 25 | `platform/app/.recipes/Nginx-Orthanc-Keycloak/dockerfile` | BUILD: Orthanc/Keycloak image and startup smoke |
| 26 | `platform/app/.recipes/Nginx-Orthanc/dockerfile` | BUILD: Orthanc image and startup smoke |
| 27 | `platform/app/.webpack/webpack.pwa.js` | BUILD: PWA production build and service-worker artifact check |
| 28 | `platform/app/README.md` | REVIEW: retain PACS environment instructions while reconciling upstream changes |
| 29 | `platform/app/package.json` | BUILD: frozen installation, app scripts, and production build |
| 30 | `platform/app/public/config/default.js` | BUILD + BROWSER: default datasource boot and WorkList/viewer smoke |
| 31 | `platform/app/public/config/docker-nginx-orthanc.js` | BUILD + BROWSER: Orthanc recipe boot and DICOMweb smoke |
| 32 | `platform/app/public/config/kheops.js` | BUILD + BROWSER: KHEOPS configuration parse and datasource smoke |
| 33 | `platform/app/src/App.tsx` | BROWSER: provider composition, Router future flags, authentication lifecycle, and startup |
| 34 | `platform/app/src/components/ViewportGrid.tsx` | BROWSER + VISUAL: viewport layout, resize, and rendering matrix |
| 35 | `platform/app/src/index.js` | BUILD + BROWSER: application bootstrap and dynamic-config trust policy |
| 36 | `platform/app/src/routes/WorkList/WorkList.tsx` | PACS-KEEP: retain the custom Orthanc/AI worklist; validate its existing unit tests and authenticated browser workflows |
| 37 | `platform/app/src/routes/index.tsx` | PACS-UNIT: PACS route registration and suppressed route-error notifications; add wildcard-route assertion after integration |
| 38 | `platform/cli/package.json` | BUILD: CLI workspace installation and command smoke |
| 39 | `platform/core/src/services/DicomMetadataStore/DicomMetadataStore.ts` | OHIF-UNIT + BROWSER: metadata ingestion through viewer/Study Browser flows |
| 40 | `platform/core/src/utils/createStudyBrowserTabs.ts` | PACS-UNIT: active Series Instance UID propagation into thumbnail display sets |
| 41 | `platform/core/src/utils/formatDate.js` | REVIEW + integrated OHIF unit assertion for strict DICOM date parsing and locale formatting |
| 42 | `platform/docs/docs/configuration/configurationFiles.md` | REVIEW: reconcile documentation with accepted configuration behavior |
| 43 | `platform/docs/yarn.lock` | BUILD: regenerate from resolved docs manifests; never conflict-edit |
| 44 | `platform/i18n/package.json` | BUILD + I18N: package build and locale loading |
| 45 | `platform/i18n/src/locales/ar/index.js` | I18N: locale registration and fallback smoke |
| 46 | `platform/i18n/src/locales/de/index.js` | I18N: locale registration and fallback smoke |
| 47 | `platform/i18n/src/locales/en-US/Common.json` | I18N: preserve PACS keys and accept new OHIF keys |
| 48 | `platform/i18n/src/locales/en-US/Onboarding.json` | I18N + BROWSER: onboarding/tutorial copy |
| 49 | `platform/i18n/src/locales/en-US/StudyBrowser.json` | I18N + BROWSER: Study Browser labels |
| 50 | `platform/i18n/src/locales/en-US/StudyList.json` | I18N + BROWSER: WorkList labels and metadata headings |
| 51 | `platform/i18n/src/locales/en-US/index.js` | I18N: namespace registration |
| 52 | `platform/i18n/src/locales/es/index.js` | I18N: locale registration and fallback smoke |
| 53 | `platform/i18n/src/locales/fr/AboutModal.json` | I18N: key-presence and French UI smoke |
| 54 | `platform/i18n/src/locales/fr/Buttons.json` | I18N: key-presence and French UI smoke |
| 55 | `platform/i18n/src/locales/fr/Common.json` | I18N: preserve PACS keys and accept new OHIF keys |
| 56 | `platform/i18n/src/locales/fr/DatePicker.json` | I18N: date-picker key and formatting smoke |
| 57 | `platform/i18n/src/locales/fr/MeasurementTable.json` | I18N: measurement-table key presence |
| 58 | `platform/i18n/src/locales/fr/Onboarding.json` | I18N + BROWSER: French onboarding/tutorial copy |
| 59 | `platform/i18n/src/locales/fr/SidePanel.json` | I18N: side-panel key presence |
| 60 | `platform/i18n/src/locales/fr/StudyBrowser.json` | I18N + BROWSER: French Study Browser labels |
| 61 | `platform/i18n/src/locales/fr/StudyList.json` | I18N + BROWSER: French WorkList labels |
| 62 | `platform/i18n/src/locales/fr/UserPreferencesModal.json` | I18N: preferences key presence |
| 63 | `platform/i18n/src/locales/fr/ViewportDownloadForm.json` | I18N: download-form key presence |
| 64 | `platform/i18n/src/locales/fr/index.js` | I18N: namespace registration |
| 65 | `platform/i18n/src/locales/zh/index.js` | I18N: locale registration and fallback smoke |
| 66 | `platform/ui-next/src/components/AllInOneMenu/BackItem.tsx` | BROWSER + VISUAL: menu navigation and styling |
| 67 | `platform/ui-next/src/components/AllInOneMenu/Menu.tsx` | BROWSER + VISUAL: menu sections, keyboard flow, and styling |
| 68 | `platform/ui-next/src/components/Button/Button.tsx` | BROWSER + VISUAL: size variants, disabled state, and tooltips |
| 69 | `platform/ui-next/src/components/DataRow/DataRow.tsx` | BROWSER + VISUAL: PACS WorkList row content and styling |
| 70 | `platform/ui-next/src/components/Errorboundary/ErrorBoundary.tsx` | PACS-UNIT through route wrapper + BROWSER: fallback and notification behavior |
| 71 | `platform/ui-next/src/components/FooterAction/FooterAction.tsx` | BROWSER + VISUAL: footer actions and disabled state |
| 72 | `platform/ui-next/src/components/Header/Header.tsx` | BROWSER + VISUAL: PACS navigation/header behavior |
| 73 | `platform/ui-next/src/components/Icons/Sources/Tools.tsx` | BUILD + VISUAL: icon compilation and toolbar rendering |
| 74 | `platform/ui-next/src/components/SegmentationTable/AddSegmentRow.tsx` | BROWSER + VISUAL: official segmentation panel flows |
| 75 | `platform/ui-next/src/components/SegmentationTable/AddSegmentationRow.tsx` | BROWSER + VISUAL: official segmentation panel flows |
| 76 | `platform/ui-next/src/components/SegmentationTable/SegmentationCollapsed.tsx` | BROWSER + VISUAL: collapsed segmentation state |
| 77 | `platform/ui-next/src/components/SegmentationTable/SegmentationSegments.tsx` | OHIF-UNIT + BROWSER + VISUAL: segment operations and representations |
| 78 | `platform/ui-next/src/components/SegmentationTable/SegmentationTableConfig.tsx` | OHIF-UNIT + BROWSER: segmentation configuration |
| 79 | `platform/ui-next/src/components/Thumbnail/Thumbnail.tsx` | PACS-UNIT through Study Browser data contract + BROWSER + VISUAL |
| 80 | `platform/ui-next/src/tailwind.css` | BUILD + VISUAL: compiled theme and representative screenshots |
| 81 | `platform/ui/src/components/Button/Button.tsx` | BROWSER + VISUAL: legacy button states used by WorkList |
| 82 | `playwright.config.ts` | BROWSER: config discovery passed; run EGL/global setup/retry policy in container |
| 83 | `version.json` | REVIEW: accept/regenerate official target version metadata |
| 84 | `version.txt` | REVIEW: accept/regenerate official target version metadata |
| 85 | `yarn.lock` | BUILD: regenerate from resolved manifests and verify frozen installation |
| 86 | `.github/workflows/playwright.yml` | REVIEW + BUILD: PACS renamed this workflow to `playwright.yml.disabled`; transplant applicable OHIF CI changes deliberately |
| 87 | `platform/docs/versioned_docs/version-3.10/configuration/configurationFiles.md` | REVIEW: OHIF moves/removes the 3.10 snapshot; confirm PACS edits survive in the 3.11 destination before accepting deletion |
| 88 | `platform/docs/versioned_docs/version-3.10/deployment/docker/docker.md` | REVIEW: OHIF moves/removes the 3.10 snapshot; confirm PACS edits survive in the 3.11 destination before accepting deletion |
| 89 | `platform/docs/versioned_docs/version-3.10/faq/technical.md` | REVIEW: OHIF moves/removes the 3.10 snapshot; confirm PACS edits survive in the 3.11 destination before accepting deletion |
| 90 | `platform/docs/versioned_docs/version-3.10/migration-guide/from-v2.md` | REVIEW: OHIF moves/removes the 3.10 snapshot; confirm PACS edits survive in the 3.11 destination before accepting deletion |
| 91 | `platform/docs/versioned_docs/version-3.10/platform/environment-variables.md` | REVIEW: OHIF moves/removes the 3.10 snapshot; confirm PACS edits survive in the 3.11 destination before accepting deletion |
| 92 | `platform/i18n/src/locales/ar/SegmentationTable.json` | I18N: verify the PACS translation survives OHIF's `SegmentationPanel.json` replacement |

## Approved WorkList disposition

The custom PACS Orthanc worklist replaces OHIF's generic mode-driven worklist. The migration keeps
the PACS implementation unchanged because it contains the product's Orthanc search and
synchronization, AI processing status, run history, result viewing, reprocessing, authentication,
and tenant workflows.

The following `v3.12.18` generic-worklist changes are therefore **not applicable** to PACS-AI:

- hiding registered modes with `mode.hide`;
- hiding registered modes when `isValidMode(...).valid` is `null`;
- changing generic mode-launch buttons to `ButtonEnums.size.smallTall`; and
- forwarding `dicomUploadComponent.containerClassName` to the generic upload modal.

Those paths do not exist in the PACS worklist: it exposes its own Basic Viewer and Segmentation
actions and uses an Orthanc synchronization modal instead of OHIF's generic DICOM upload modal.
Adopting the OHIF mode registry or upload component would be a separate product redesign, not part
of this version migration. The official target suite remains the evidence for the untouched OHIF
implementation; PACS validation will cover the retained Orthanc worklist.

## Explicit missing assertions to add during integration

The following OHIF 3.12 contracts are material and do not have sufficiently direct official unit
coverage in the untouched tag. They must be added as focused integrated tests when their source
groups are resolved:

1. DICOMweb metadata requests omit transfer-syntax negotiation while pixel-data requests retain it.
2. `formatDate` strictly parses compact and dotted DICOM dates and applies the active locale.
3. The wildcard not-found route uses the React Router 6 path contract.
4. PACS custom providers/routes remain registered with the 3.12 Router future flags.

These tests should preserve stable behavior rather than assert private implementation details.
