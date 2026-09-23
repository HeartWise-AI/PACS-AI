# DeepCORO-SYNTAX result presentation contract

The dedicated renderer is selected only for `DeepCORO-SYNTAX` version `5.0.0`. It accepts the
deployed JSON output containing the modified SYNTAX score, left and right territory scores,
severity probabilities, and intermediate-to-high operating threshold.

Only finite, bounded scores and probabilities with the documented units and categories are
rendered. Model-authored diagnosis, recommendation markup, and threshold notes are not displayed.
Malformed or future payloads fall back to the generic renderer.
