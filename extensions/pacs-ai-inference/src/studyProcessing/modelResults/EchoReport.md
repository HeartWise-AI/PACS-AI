# Structured echo report (PanEcho, EchoAlign)

The PanEcho (1.1.x / 1.2.x) and EchoAlign (0.1.x) drawers show one structured echo report:

1. Sections in standard echo order: left ventricle, right ventricle, atria, valves (aortic, mitral,
   tricuspid, pulmonic), aorta, pericardium / other. Empty sections are omitted.
2. In each section the measured values from the study's DICOM SR (`echo-sr-measurements`) come first,
   tagged **Measured**, then the model's outputs, tagged **AI estimate**, with ± the mean absolute
   error against the MHI SR when known, and the probability (and released threshold) of classifications.
   Positive AI outputs are highlighted. When the measured value is normal but the AI flags the finding,
   the section carries a discordance note.
3. The aortic valve is one subsection: its first line is the measured AS grade (echo-sr `asGrading`),
   then the measured AV values, then the AI aortic stenosis screening (PanEcho 1.1.3+ MHI-calibrated
   label and caveat, P(severe AS), P(any AS), the AV Vmax AI estimate and its uncorrected value;
   EchoAlign P(severe), P(any), Vmax and the released ≥ moderate classifier).
4. **Conclusion / Résultats pertinents**: only positive findings, one line per item `Structure — text`,
   by structure in echo order, measured abnormalities first, then AI findings at the model's released or
   calibrated threshold. When the SR has a value for the finding, the measured grading wins (AI-negative:
   "discordant"; measured normal + AI positive: no conclusion line, a section note instead). No positive
   finding: "No significant abnormality detected (measured + AI)".

EchoAlign keeps its research-use banner at the very top.

## Source of truth

`echoReport/echo_report_thresholds.json` (schema `echo-report-thresholds/1`, version **2026-11-28.1**) is a
verbatim copy of `pacs-ai-backend/model-examples/PanEcho/data/echo_report_thresholds.json`; the same file is
used by the PanEcho / EchoAlign HTML reports and CardioAgent's chat summary. `echoReport/echoReport.ts` is a
port of `echo_report.py`; `echoReport.parity.test.ts` checks it against the Python output
(`__fixtures__/parityCases.json`, synthetic data). Change the thresholds in every copy and bump the version.

SR routing: each SR measurement goes to a section by its Finding Site (`srRouting`); measurement-name
overrides win (TAPSE recorded under Tricuspid Valve → right ventricle; mitral E, A, E/A, deceleration time
and E/e' → left ventricle diastolic function); Patient / Unspecified sites are not shown.

Sex-specific cut-offs use the DICOM PatientSex of the open study (from the loaded display sets); the male
cut-offs are used when it is unknown.

## Measured cut-offs

| Structure | Rule | Value | Cut-offs (mild / moderate / severe) | Wording | Reference |
|---|---|---|---|---|---|
| lv | lvSize | lvidd | > male 5.8, 6.3, 6.8; female 5.2, 5.6, 6.1 | Mild LV dilation / Moderate LV dilation / Severe LV dilation | ase2015 |
| lv | lvSizeVolume | lvedvi | > male 74; female 61 | LV dilation (end-diastolic volume index) | ase2015 |
| lv | lvh | lvWall | > male 1.0, 1.3, 1.6; female 0.9, 1.2, 1.5 | Mild LV hypertrophy (wall thickness) / Moderate LV hypertrophy (wall thickness) / Severe LV hypertrophy (wall thickness) | ase2015 |
| lv | lvef | lvef | < 50, 40, 30 | Mildly reduced LVEF / Moderately reduced LVEF / Severely reduced LVEF | ase2015 |
| lv | gls | gls | < 16 | Reduced global longitudinal strain | ase2015strain |
| lv | wma | wmsi | > 1.0 | Regional wall motion abnormality | ase2015 |
| lv | fillingPressure | eOverEPrime | > 14 | Elevated E/e' (> 14): raised LV filling pressure likely | ase2016 |
| lv | lvotObstruction | lvotPeakGradient | ≥ 30, 50 | LVOT gradient ≥ 30 mmHg (obstruction) / LVOT gradient ≥ 50 mmHg (significant obstruction) | acc2020hcm |
| rv | rvTapse | tapse | < 1.7 | RV systolic dysfunction (TAPSE < 1.7 cm) | ase2015 |
| rv | rvSPrime | rvSPrime | < 9.5 | RV systolic dysfunction (S' < 9.5 cm/s) | ase2015 |
| rv | rvSize | rvBasal | > 4.1 | RV dilation (basal diameter > 4.1 cm) | ase2015 |
| la | laSize | lavi | > 34, 41, 48 | Mild LA enlargement / Moderate LA enlargement / Severe LA enlargement | ase2015 |
| ra | raSize | raArea | > 18 | RA enlargement (area > 18 cm²) | rudski2010 |
| ra | ivc | ivc | > 2.1 | Dilated IVC (> 2.1 cm): raised RA pressure possible | rudski2010 |
| av | aorticStenosis | echo-sr asGrading | Vmax ≥ 2.6 / 3.0 / 4.0 m/s or MG ≥ 20 / 40 mmHg; AVA < 1.0 cm² discordant | Mild aortic stenosis / Moderate aortic stenosis / Severe aortic stenosis | ase2017as |
| av | aorticRegurgitationPht | avPht | < 200 | Short AR pressure half-time (< 200 ms): severe aortic regurgitation possible | ase2017regurg |
| mv | mitralGradient | mvMeanGradient | ≥ 5, 10 | Elevated mitral mean gradient (≥ 5 mmHg): mitral stenosis possible / High mitral mean gradient (≥ 10 mmHg): severe mitral stenosis possible | ase2009stenosis |
| tv | trGradient | trPeakGradient | > 35, 50 | Elevated TR gradient (> 35 mmHg): pulmonary hypertension possible / High TR gradient (> 50 mmHg): pulmonary hypertension likely | rudski2010 |
| pv | pulmonicGradient | pvPeakGradient | ≥ 36, 64 | Pulmonic valve gradient ≥ 36 mmHg (moderate stenosis range) / Pulmonic valve gradient ≥ 64 mmHg (severe stenosis range) | ase2009stenosis |
| aorta | aorticRoot | aorticRoot | ≥ 4.0, 4.5, 5.0 | Dilated aortic root (≥ 4.0 cm) / Dilated aortic root (≥ 4.5 cm) / Aortic root aneurysm (≥ 5.0 cm) | esc2024aorta |
| aorta | ascendingAorta | ascendingAorta | ≥ 4.0, 4.5, 5.0 | Dilated ascending aorta (≥ 4.0 cm) / Dilated ascending aorta (≥ 4.5 cm) / Ascending aortic aneurysm (≥ 5.0 cm) | esc2024aorta |

Values are compared as displayed (rounded to the metric's digits). LAVI is the SR's index, else LA volume / BSA.

## References

- **ase2015**: Lang RM et al. Recommendations for cardiac chamber quantification by echocardiography in adults: an update from the ASE and the EACVI. J Am Soc Echocardiogr 2015;28:1-39.
- **ase2016**: Nagueh SF et al. Recommendations for the evaluation of left ventricular diastolic function by echocardiography: an update from the ASE and the EACVI. J Am Soc Echocardiogr 2016;29:277-314.
- **ase2017as**: Baumgartner H et al. Recommendations on the echocardiographic assessment of aortic valve stenosis: a focused update from the EACVI and the ASE. J Am Soc Echocardiogr 2017;30:372-392.
- **ase2017regurg**: Zoghbi WA et al. Recommendations for noninvasive evaluation of native valvular regurgitation: a report from the ASE. J Am Soc Echocardiogr 2017;30:303-371.
- **ase2009stenosis**: Baumgartner H et al. Echocardiographic assessment of valve stenosis: EAE/ASE recommendations for clinical practice. J Am Soc Echocardiogr 2009;22:1-23.
- **rudski2010**: Rudski LG et al. Guidelines for the echocardiographic assessment of the right heart in adults: a report from the ASE. J Am Soc Echocardiogr 2010;23:685-713.
- **acc2020valve**: Otto CM et al. 2020 ACC/AHA guideline for the management of patients with valvular heart disease. Circulation 2021;143:e72-e227.
- **acc2020hcm**: Ommen SR et al. 2020 AHA/ACC guideline for the diagnosis and treatment of patients with hypertrophic cardiomyopathy. Circulation 2020;142:e558-e631.
- **esc2022ph**: Humbert M et al. 2022 ESC/ERS guidelines for the diagnosis and treatment of pulmonary hypertension. Eur Heart J 2022;43:3618-3731.
- **esc2024aorta**: Mazzolai L et al. 2024 ESC guidelines for the management of peripheral arterial and aortic diseases. Eur Heart J 2024;45:3538-3700.
- **ase2015strain**: Voigt JU et al. Definitions for a common standard for 2D speckle tracking echocardiography: consensus document of the EACVI/ASE/Industry Task Force. J Am Soc Echocardiogr 2015;28:183-193.
