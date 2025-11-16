import { AMPLITUDE_API_KEY } from '@/constants/amplitude.config';
import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* 
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native. 
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
        
        {/* Amplitude Analytics with Session Replay */}
        <script src={`https://cdn.amplitude.com/script/${AMPLITUDE_API_KEY}.js`}></script>
        <script src="https://cdn.amplitude.com/libs/plugin-session-replay-browser-1-latest.umd.js"></script>
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
body {
  background-color: #FAF8F0;
}
* {
  outline: none !important;
}
*:focus {
  outline: none !important;
  box-shadow: none !important;
}
*:focus-visible {
  outline: none !important;
  box-shadow: none !important;
}
input:focus,
textarea:focus,
button:focus,
a:focus {
  outline: none !important;
  box-shadow: none !important;
}`;
