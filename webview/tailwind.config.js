/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // VS Code-like color scheme
        background: {
          primary: 'var(--vscode-editor-background)',
          secondary: 'var(--vscode-sideBar-background)',
          tertiary: 'var(--vscode-panel-background)',
        },
        foreground: {
          primary: 'var(--vscode-editor-foreground)',
          secondary: 'var(--vscode-descriptionForeground)',
          muted: 'var(--vscode-disabledForeground)',
        },
        accent: {
          primary: 'var(--vscode-focusBorder)',
          secondary: 'var(--vscode-button-background)',
          hover: 'var(--vscode-button-hoverBackground)',
        },
        border: {
          primary: 'var(--vscode-panel-border)',
          secondary: 'var(--vscode-sideBar-border)',
        },
        // Custom colors for our app
        codenection: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        }
      },
      fontFamily: {
        mono: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
        sans: ['Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} 