import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default ts.config(
  {
    ignores: [
      '.agents/',
      '.svelte-kit/',
      'build/',
      '.vercel/',
      'node_modules/',
      'src/lib/data/*.json'
    ]
  },
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  prettier,
  svelte.configs.prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      // The app is served from the domain root with no `base` path, and most of
      // what this rule flags is an external URL built from bundled data (rent
      // sources, apartment-search links) that it cannot verify statically.
      'svelte/no-navigation-without-resolve': 'off',
      // Every Map/URLSearchParams here is a deliberate non-reactive helper: a
      // Leaflet marker registry and one-shot query-string parsing/serialization.
      // Swapping in the reactive variants would add tracking we do not want.
      'svelte/prefer-svelte-reactivity': 'off'
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        extraFileExtensions: ['.svelte'],
        svelteConfig
      }
    }
  },
  {
    // Tailwind class hygiene. Scoped to markup files — these rules read the
    // generated theme from the CSS entry point, so they need Tailwind loaded.
    files: ['**/*.svelte'],
    plugins: { 'better-tailwindcss': betterTailwindcss },
    settings: {
      'better-tailwindcss': { entryPoint: 'src/app.css' }
    },
    rules: {
      'better-tailwindcss/no-duplicate-classes': 'error',
      'better-tailwindcss/no-conflicting-classes': 'error',
      'better-tailwindcss/no-deprecated-classes': 'error',
      'better-tailwindcss/no-concatenated-classes': 'error',
      'better-tailwindcss/no-unnecessary-whitespace': 'error',
      'better-tailwindcss/enforce-canonical-classes': 'error',
      'better-tailwindcss/enforce-shorthand-classes': 'error',
      'better-tailwindcss/no-unknown-classes': [
        'error',
        {
          // The map container is tagged so RentMap's scoped <style> can reach
          // Leaflet's own DOM, which never passes through our markup.
          // Discovery uses scoped CSS for its photographic layout.
          ignore: [
            '^leaflet-',
            '^motion-',
            '^(landing|landing-.*|featured-.*|discovery|discovery-.*|city-gallery|destination|destination-.*|photo-credit|city-arrival|arrival-photo|arrival-heading)$'
          ]
        }
      ]
      // enforce-consistent-class-order / enforce-consistent-line-wrapping are
      // intentionally off: prettier-plugin-tailwindcss owns class ordering and
      // Prettier owns line wrapping, and the two would fight.
    }
  }
);
