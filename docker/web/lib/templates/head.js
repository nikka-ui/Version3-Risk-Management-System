/** Shared <head> assets for all HTML pages */
const FONT_LINKS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">`;

/** Bump this when CSS/JS assets change so browsers fetch the new files. */
const ASSET_VERSION = '20260702';

/** Stylesheet link with a cache-busting version query. */
const STYLESHEET_LINK = `<link rel="stylesheet" href="/css/app.css?v=${ASSET_VERSION}">`;

module.exports = { FONT_LINKS, ASSET_VERSION, STYLESHEET_LINK };
