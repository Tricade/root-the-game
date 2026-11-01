(function (root, factory) {
  const brand = factory();
  if (typeof module === 'object' && module.exports) module.exports = brand;
  if (root) root.ROOTBrand = brand;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return Object.freeze({
    title: 'ROOT · Network OS',
    productName: 'ROOT · Network OS',
    wordmark: 'root',
    label: 'NETWORK OS',
    repository: 'root-network-os',
    // Installed 1.5.0 clients already use this profile. A visible rename must
    // not silently separate their saves or UI preferences from the application.
    legacyProfileName: 'ROOT Cyberbunker',
  });
});
