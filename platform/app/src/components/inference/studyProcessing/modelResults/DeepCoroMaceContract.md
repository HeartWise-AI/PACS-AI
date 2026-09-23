# DeepCORO-MACE result contract

The dedicated renderer is selected for `DeepCORO_MACE` or the deployed display identity
`DeepCORO-MACE`, version `1.0.0`, and the deployed
payload shape represented by `deepCoroMaceContract.ts`.

The contract requires the one-year horizon, all four primary endpoints, all five exploratory
endpoints, bounded score and threshold values, threshold flags, and recommendation metadata.
Unknown fields are discarded. Model-authored labels, warnings, diagnosis text, threshold notes,
and recommendation HTML are never rendered; the UI uses fixed localized copy instead.

An identity, version, or payload mismatch retains the generic renderer so future output remains
inspectable without being interpreted by an incompatible template.
