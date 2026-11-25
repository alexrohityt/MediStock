/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        medical: {
          50: "#effaf6",
          100: "#d7f3e8",
          500: "#138a6a",
          600: "#0f7559",
          700: "#0c5d47"
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 117, 89, 0.08)"
      }
    }
  },
  plugins: []
};
