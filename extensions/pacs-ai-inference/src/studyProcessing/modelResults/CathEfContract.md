# CathEF result contract

The dedicated renderer is selected only for `CathEF` version `1.6.0` and the deployed payload
shape represented by `cathEfContract.ts`.

Each vessel entry requires a non-negative integer series number and one of the acquisition classes
emitted by the model. The optional LVEF block must contain at least one bounded value associated
with a returned series. Unknown fields are discarded and model-authored recommendation text is
not rendered.

An identity, version, or payload mismatch retains the generic renderer so future output remains
inspectable without being interpreted by an incompatible template.
