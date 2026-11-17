# CathEF-CLIP result contract

The dedicated renderer is selected only for `CathEF-CLIP` version `1.0.0` and the successful
deployed payload shape represented by `cathEfClipContract.ts`.

The contract requires a bounded LVEF percentage, bounded reduced-EF probability and threshold,
and the model's reduced or preserved classification. Unknown fields are discarded. Model-authored
diagnosis and recommendation text are never rendered; the UI uses fixed localized copy instead.

An identity, version, or payload mismatch—including the model's empty no-video result—retains the
generic renderer so output remains inspectable without being interpreted as a successful estimate.
