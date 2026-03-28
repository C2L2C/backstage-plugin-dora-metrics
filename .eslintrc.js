module.exports = require('@backstage/cli/config/eslint-factory')(__dirname, {
  rules: {
    // Inline style objects in UI components intentionally use nested ternaries
    // for dark/light mode and hover state — a flat if/else would be far noisier.
    'no-nested-ternary': 'off',

    // Single-line multi-var declarations are fine in tight logic (e.g. `let best = 0, bestDist = Infinity`)
    'one-var': 'off',

    // Backdrop and Card divs are decorative click-to-dismiss targets, not interactive controls.
    // Full keyboard/ARIA support is out of scope for a metrics dashboard plugin.
    'jsx-a11y/click-events-have-key-events': 'off',
    'jsx-a11y/no-static-element-interactions': 'off',

    // React default import deprecation warning — suppress until JSX transform migration is done
    'no-restricted-syntax': 'off',
  },
});
