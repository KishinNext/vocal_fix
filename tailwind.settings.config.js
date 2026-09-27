// Settings pages (pages/*.html + src/settings/*): Material-style tokens.
// Kept separate from the editor config because it redefines rounded-* sizes.
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./pages/**/*.html', './src/settings.ts', './src/settings/**/*.ts'],
  theme: {
  "extend": {
    "colors": {
      "on-background": "#e3e2e6",
      "secondary-container": "#31503a",
      "surface-dim": "#121316",
      "on-tertiary": "#1e3243",
      "tertiary-container": "#95aabe",
      "primary-fixed": "#ffddbb",
      "error-container": "#93000a",
      "surface-container-low": "#1b1b1f",
      "surface-container-highest": "#343538",
      "primary": "#fcb96f",
      "surface-container-high": "#292a2d",
      "secondary-fixed": "#c8ebce",
      "outline-variant": "#514539",
      "surface-bright": "#38393c",
      "on-tertiary-fixed": "#061d2d",
      "on-secondary": "#183623",
      "on-primary-fixed-variant": "#673d00",
      "on-error": "#690005",
      "primary-container": "#d99b54",
      "tertiary": "#b3c9de",
      "outline": "#9e8e7f",
      "inverse-primary": "#855311",
      "on-surface": "#e3e2e6",
      "on-error-container": "#ffdad6",
      "on-primary": "#482900",
      "surface": "#141416",
      "secondary": "#adcfb3",
      "on-tertiary-container": "#2a3f4f",
      "on-secondary-fixed-variant": "#2f4d38",
      "background": "#141416",
      "on-tertiary-fixed-variant": "#34495a",
      "on-surface-variant": "#d5c3b3",
      "surface-variant": "#343538",
      "surface-container": "#1f1f23",
      "inverse-on-surface": "#2f3034",
      "surface-tint": "#fcb96f",
      "on-secondary-fixed": "#02210f",
      "primary-fixed-dim": "#fcb96f",
      "on-primary-container": "#593400",
      "error": "#ffb4ab",
      "on-secondary-container": "#9fc1a5",
      "secondary-fixed-dim": "#adcfb3",
      "on-primary-fixed": "#2b1700",
      "inverse-surface": "#e3e2e6",
      "tertiary-fixed-dim": "#b3c9de",
      "tertiary-fixed": "#cfe5fa",
      "surface-container-lowest": "#0d0e11"
    },
    "borderRadius": {
      "DEFAULT": "0.125rem",
      "lg": "0.25rem",
      "xl": "0.5rem",
      "full": "0.75rem"
    },
    "spacing": {
      "margin": "1rem",
      "space-xl": "1.5rem",
      "space-sm": "0.5rem",
      "space-md": "0.75rem",
      "gutter-compact": "0.5rem",
      "gutter": "0.75rem",
      "space-xs": "0.25rem",
      "space-lg": "1rem"
    },
    "fontFamily": {
      "label-sm": [
        "JetBrains Mono Variable",
        "JetBrains Mono",
        "ui-monospace",
        "monospace"
      ],
      "label-md": [
        "JetBrains Mono Variable",
        "JetBrains Mono",
        "ui-monospace",
        "monospace"
      ],
      "label-xs": [
        "JetBrains Mono Variable",
        "JetBrains Mono",
        "ui-monospace",
        "monospace"
      ],
      "body-lg": [
        "Inter Variable",
        "Inter",
        "ui-sans-serif",
        "system-ui",
        "sans-serif"
      ],
      "headline-lg": [
        "Inter Variable",
        "Inter",
        "ui-sans-serif",
        "system-ui",
        "sans-serif"
      ],
      "headline-md": [
        "Inter Variable",
        "Inter",
        "ui-sans-serif",
        "system-ui",
        "sans-serif"
      ],
      "headline-xl": [
        "Inter Variable",
        "Inter",
        "ui-sans-serif",
        "system-ui",
        "sans-serif"
      ],
      "body-sm": [
        "Inter Variable",
        "Inter",
        "ui-sans-serif",
        "system-ui",
        "sans-serif"
      ],
      "body-md": [
        "Inter Variable",
        "Inter",
        "ui-sans-serif",
        "system-ui",
        "sans-serif"
      ]
    },
    "fontSize": {
      "label-sm": [
        "11px",
        {
          "lineHeight": "14px",
          "letterSpacing": "0.03em",
          "fontWeight": "500"
        }
      ],
      "label-md": [
        "12px",
        {
          "lineHeight": "16px",
          "letterSpacing": "0.02em",
          "fontWeight": "500"
        }
      ],
      "label-xs": [
        "10px",
        {
          "lineHeight": "12px",
          "letterSpacing": "0.04em",
          "fontWeight": "400"
        }
      ],
      "body-lg": [
        "15px",
        {
          "lineHeight": "24px",
          "letterSpacing": "-0.005em",
          "fontWeight": "400"
        }
      ],
      "headline-lg": [
        "24px",
        {
          "lineHeight": "32px",
          "letterSpacing": "-0.015em",
          "fontWeight": "600"
        }
      ],
      "headline-md": [
        "18px",
        {
          "lineHeight": "26px",
          "letterSpacing": "-0.01em",
          "fontWeight": "500"
        }
      ],
      "headline-xl": [
        "32px",
        {
          "lineHeight": "40px",
          "letterSpacing": "-0.02em",
          "fontWeight": "600"
        }
      ],
      "body-sm": [
        "12px",
        {
          "lineHeight": "18px",
          "letterSpacing": "0.005em",
          "fontWeight": "400"
        }
      ],
      "body-md": [
        "13px",
        {
          "lineHeight": "20px",
          "letterSpacing": "0em",
          "fontWeight": "400"
        }
      ]
    }
  }
},
}
