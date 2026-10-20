/** Same theme as the v1.9.5 inline config. */
const config = {
            darkMode: 'class',
            theme: {
                extend: { screens: { xs: '420px' },
                    fontFamily: {
                        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', 'sans-serif'],
                    },
                    colors: {
                        zinc: { 50:'#FBF9F3', 100:'#F3F0E6', 200:'#E4DFD0', 300:'#CFC8B4', 400:'#A59E8C', 500:'#7A7466', 600:'#57524A', 700:'#3A3731', 800:'#25231F', 900:'#171613', 950:'#0E0D0B' },
                        apple: {
                            blue: 'rgb(var(--accent) / <alpha-value>)',
                            blueHover: 'rgb(var(--accent-hover) / <alpha-value>)',
                            indigo: 'rgb(var(--accent) / <alpha-value>)',
                            glass: 'rgba(28, 28, 30, 0.82)',
                            glassLight: 'rgba(255, 255, 255, 0.82)',
                            glassHover: 'rgba(44, 44, 46, 0.90)',
                            border: 'rgba(255, 255, 255, 0.14)',
                            borderLight: 'rgba(0, 0, 0, 0.12)',
                            amber: 'rgb(var(--amber) / <alpha-value>)',
                        }
                    },
                    boxShadow: {
                        'glass': '0 20px 40px -15px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.2)',
                        'glass-glow': '0 0 45px -5px rgba(56, 194, 123, 0.3)',
                    }
                }
            }
        };
config.content = ['./index.html', './src/**/*.js'];
export default config;
