import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080b14",
        panel: "#101522",
        line: "#222a3b",
      },
    },
  },
  plugins: [],
};

export default config;
