# DeepCORO-CTO result presentation contract

The dedicated renderer is selected only for `DeepCORO-CTO` version `2.0.0`. It accepts the
deployed per-artery JSON output containing the imaging J-CTO score, selected artery, four
morphology components, and LAD/RCA/LCx scores.

Scores and probabilities must be finite and within their documented ranges. Model-authored
diagnosis, labels, warnings, and recommendation markup are not displayed. The UI uses fixed
component labels and fixed research/LCx cautions. Malformed or future payloads fall back to the
generic renderer.
