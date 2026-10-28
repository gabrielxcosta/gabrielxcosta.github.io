# Gabriel F. Costa — Academic Portfolio

Bilingual (English/Portuguese) academic portfolio, ready for GitHub Pages.

## Publish at gabrielxcosta.github.io

1. On GitHub, create a **public** repository named exactly `gabrielxcosta.github.io` under the `gabrielxcosta` account.
2. Extract the ZIP. Upload **all files from inside the extracted folder** to the root of the repository. `index.html` must be directly in the repository root, not inside an extra subfolder.
3. Commit the uploaded files to the `main` branch.
4. Open **Settings → Pages**. Under **Build and deployment**, select **Deploy from a branch**, branch **main**, folder **/(root)**, then **Save**.
5. Open <https://gabrielxcosta.github.io/> after GitHub Pages finishes publishing. Publication can take several minutes.

### Site contents

- `index.html` — entry point and SEO metadata (`Gabriel F. Costa`)
- `style.css`, `content.css`, `visual.css`, `visual-overrides.css` — design and layout
- `app.js`, `content.js`, `visual.js` — language switching, content, interactive graph
- `gabriel-portrait.png` — profile photo
- `cv-gabriel-costa.pdf` — downloadable academic CV
- `.nojekyll` — ensures GitHub Pages serves the static files directly

The site does not require Node.js, packages, a backend, or a build step. All links to local assets are relative, so the site can be hosted from the root of GitHub Pages.

## Google Search

The page title and social metadata are **Gabriel F. Costa**. After publishing, register `https://gabrielxcosta.github.io/` with [Google Search Console](https://search.google.com/search-console/) and request indexing. Google ultimately decides when to index the site and how the title appears in search results.

## Updating the site

Replace or edit the files in this repository and commit to `main`. GitHub Pages will publish the update automatically. To update the PDF without changing its link, replace `cv-gabriel-costa.pdf` using the same filename.
