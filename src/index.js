import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import App from './App';
import theme from './theme';
import { ArweaveWalletKit } from 'arweave-wallet-kit';

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);

root.render(
  <ArweaveWalletKit
    config={{
      permissions: ["ACCESS_ADDRESS", "SIGN_TRANSACTION"],
      ensurePermissions: true,
    }}
  >
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </ArweaveWalletKit>
);
