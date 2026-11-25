# Native consumption

This extraction ships five **web-only** Law Library component families.
No React Native components or native component export paths are implemented.
Do not import the DOM components into Expo or imply native parity.

After user approval, an Expo app may depend on this workspace package and read
portable values from `@workspace/fto-law-library-schema/tokens`. The export
contains `tokens.color.light`, `tokens.color.dark`, `tokens.fontFamily`,
`tokens.radius` and `tokens.spacing`. Native font registration and native
components require separate implementation and verification.
