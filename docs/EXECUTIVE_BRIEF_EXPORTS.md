# City of Columbus Chain of Command Brief exports

The canonical source is `docs/COLUMBUS_FTO_PORTAL_BRIEFING.md`. After updating it, run:

```sh
pnpm run export:executive-brief
```

The command refreshes the Markdown, plain-text, HTML, and PDF files under
`generated-artifacts/website-records/`, all using the
`City-of-Columbus-Chain-of-Command-Brief` filename stem. The HTML/PDF retain the
existing letter-page print styling used for the Columbus website records.
The Contents links target generated section anchors, and Chromium preserves
those links in the PDF for in-document navigation.

Chromium must be available on `PATH`; set `CHROME_BIN` if its executable has a
different name or location. Run `pnpm run test:executive-brief-export` to check
the Markdown conversions and print styling without regenerating the files.
