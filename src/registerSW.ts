export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // IMPORTANT: use a plain relative string here, not `new URL('./sw.js', import.meta.url)`.
      // After bundling, this file's own import.meta.url points at /assets/index-<hash>.js,
      // so a URL built relative to it would incorrectly resolve to /assets/sw.js (404).
      // A plain string passed to register() resolves relative to the *page's* URL instead,
      // which correctly finds /sw.js (or /<repo-name>/sw.js on a GitHub Pages project site).
      navigator.serviceWorker
        .register('./sw.js', { scope: './' })
        .then((reg) => {
          console.log('Up2Eng Service Worker registered with scope:', reg.scope);

          // Periodically check for a new version of the SW (e.g. new deploy) so
          // updates get picked up without requiring a hard refresh from the user.
          setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);

          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'activated') {
                console.log('Up2Eng Service Worker: new version activated.');
              }
            });
          });
        })
        .catch((err) => {
          console.log('Up2Eng Service Worker registration failed:', err);
        });

      // Reload once when a new SW takes control, so the page is guaranteed to be
      // running against the assets the new SW expects. Guarded so it only fires
      // on an actual update, not on the very first install.
      let refreshed = false;
      let hadController = Boolean(navigator.serviceWorker.controller);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshed || !hadController) {
          hadController = true;
          return;
        }
        refreshed = true;
        window.location.reload();
      });
    });
  }
}
