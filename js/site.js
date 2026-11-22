'use strict';

/* Shared by every page: the GitHub link in the header, the version and date
   (from js/version.js), and the contact email on the About page. */

// The GitHub repository. When it is set, a "GitHub" link appears in the header.
const REPO_URL = 'https://github.com/amnghn/Diospyros-NC-Atlas';

(function () {
  const site = window.SITE || {};

  const repoLink = document.getElementById('repo-link');
  if (repoLink && REPO_URL) {
    repoLink.href = REPO_URL;
    repoLink.hidden = false;
  }

  document.querySelectorAll('[data-site="version"]').forEach(el => { el.textContent = site.version || ''; });
  document.querySelectorAll('[data-site="date"]').forEach(el => { el.textContent = site.date || ''; });

  // The address is put together here, so that it does not appear as plain text in the HTML,
  // where spam bots look for addresses.
  const contact = document.getElementById('contact-email');
  if (contact) {
    const address = ['aminghane', 'univie.ac.at'].join('@');
    const link = document.createElement('a');
    link.href = 'mailto:' + address;
    link.textContent = address;
    contact.replaceChildren(link);
  }
})();
