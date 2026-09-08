# Third-party components

The application uses the dependencies and versions pinned in `package-lock.json`.

Browser bundles added in v1.1:

| Component | Purpose | License |
|---|---|---|
| [pdf-lib](https://github.com/Hopding/pdf-lib) | Local image/PDF conversion | MIT |
| [fflate](https://github.com/101arrowz/fflate) | ZIP packaging and DOCX preservation | MIT |

`npm run assets:build` copies their license files into `public/vendor/` and the extension package. Generated browser bundles are rebuilt from npm dependencies rather than edited manually.
