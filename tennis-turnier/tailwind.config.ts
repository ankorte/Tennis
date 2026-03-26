import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        tennis: {
          green: '#2d6a4f',
          lightgreen: '#40916c',
          yellow: '#d4a017',
          court: '#a8d5a2',
        },
      },
    },
  },
  plugins: [],
}
export default config
