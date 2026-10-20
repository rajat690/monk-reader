# Monk Reader

Static reader for [The Monk Who Loved History](https://rajatkbanerjee07gmailcom-ojuie.wordpress.com/), a WordPress.com blog on history, geopolitics, and the fault lines of the 21st century.

The app loads posts from the WordPress.com public API, and falls back to the copy in `data/` and `media/` when that API is unreachable. You can browse, search, and filter by category, open an essay, switch to dark mode, and install it as a progressive web app. Pages you have already opened stay available offline. When a post has no featured image, the card and the essay header use the first image in the post.

`node scripts/backup.mjs` refreshes the saved posts and images. A weekly Actions workflow runs that script and commits any changes.

Published at [rajat690.github.io/monk-reader](https://rajat690.github.io/monk-reader/).

Live site: https://rajat690.github.io/monk-reader/
