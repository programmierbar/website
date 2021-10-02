const colors = require('tailwindcss/colors');
const plugin = require('tailwindcss/plugin');

module.exports = {
  mode: 'jit',
  purge: [],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      black: colors.black,
      white: colors.white,
      gray: colors.gray,
      blue: {
        DEFAULT: '#00A1FF',
        50: '#E5F6FF',
        100: '#CCECFF',
        200: '#99D9FF',
        300: '#66C7FF',
        400: '#33B4FF',
        500: '#00A1FF',
        600: '#0081CC',
        700: '#006199',
        800: '#004066',
        900: '#002033',
      },
      lime: {
        DEFAULT: '#CFFF00',
        50: '#FAFFE5',
        100: '#F5FFCC',
        200: '#ECFF99',
        300: '#E2FF66',
        400: '#D9FF33',
        500: '#CFFF00',
        600: '#A6CC00',
        700: '#7C9900',
        800: '#536600',
        900: '#293300',
      },
      pink: {
        DEFAULT: '#E92980',
        50: '#FEF9FC',
        100: '#FCE2EE',
        200: '#F7B4D2',
        300: '#F385B7',
        400: '#EE579B',
        500: '#E92980',
        600: '#CA1567',
        700: '#9C104F',
        800: '#6E0B38',
        900: '#3F0720',
      },
    },
    container: {
      center: true,
      screens: {
        DEFAULT: '100%',
        sm: '100%',
        md: '100%',
        lg: '100%',
        xl: '100%',
        '2xl': '1536px',
      },
    },
    screens: {
      xs: '520px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      '3xl': '2000px',
    },
    extend: {
      borderWidth: {
        3: '3px',
        6: '6px',
      },
      fontSize: {
        '7.5xl-screen': '5vh',
        '8.5xl-screen': '7vh',
      },
      height: {
        '4/6-screen': '66.666667vh',
        '1/2-screen': '50vh',
      },
      maxHeight: {
        '1/2-screen': '50vh',
      },
      minHeight: {
        8: '2rem',
        9: '2.25rem',
        11: '2.75rem',
        80: '20rem',
      },
      scale: {
        65: '0.65',
        70: '0.7',
        80: '0.8',
        200: '2',
        250: '2.5',
      },
      spacing: {
        0.75: '0.1875rem',
        1.25: '0.3rem',
        112: '28rem',
        120: '30rem',
      },
      translate: {
        '3/20': '15%',
      },
      zIndex: {
        '-1': '-1',
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/line-clamp'),
    plugin(function ({ addUtilities }) {
      const newUtilities = {
        '.vertical-rl': {
          writingMode: 'vertical-rl',
        },
        '.scroll-snap-x': {
          scrollSnapType: 'x mandatory',
        },
        '.scroll-snap-center': {
          scrollSnapAlign: 'center',
        },
        '.scrollbar-none': {
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
      };
      addUtilities(newUtilities);
    }),
  ],
};
