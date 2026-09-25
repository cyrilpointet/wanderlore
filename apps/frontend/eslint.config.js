import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import i18next from 'eslint-plugin-i18next'

export default tseslint.config(
  { ignores: ['dist', 'src/routeTree.gen.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // A route file exports `Route` next to its component; the router plugin splits them at build.
    files: ['src/routes/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    /**
     * No interface text is ever written in a component: every string a player
     * can read — or hear, through `aria-label` and `alt` — goes through a
     * translation key. `jsx-only` checks attributes as well as text; the
     * attributes excluded here carry markup, routing or wiring, never words.
     */
    files: ['src/**/*.tsx'],
    ignores: ['src/**/*.test.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          'mode': 'jsx-only',
          'jsx-attributes': {
            exclude: [
              'className',
              'style',
              'type',
              'key',
              'id',
              'width',
              'height',
              'to',
              'href',
              'rel',
              'target',
              'name',
              'htmlFor',
              'role',
              'autoComplete',
              'inputMode',
              'method',
              'lang',
              'dir',
              'aria-live',
              'aria-hidden',
              'aria-current',
              'aria-describedby',
              'aria-labelledby',
              'data-.*',
            ],
          },
        },
      ],
    },
  }
)
