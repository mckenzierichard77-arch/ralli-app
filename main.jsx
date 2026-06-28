import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './src/App.jsx'
import { MantineProvider } from "@mantine/core";

ReactDOM.createRoot(document.getElementById("root")).render(
  <MantineProvider>
    <App />
  </MantineProvider>
);
