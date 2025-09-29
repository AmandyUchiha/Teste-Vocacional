// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { createClient } from '@supabase/supabase-js';

// URL do seu projeto Supabase
const supabaseUrl = 'https://rvlgihlckmgerxnpdfji.supabase.co';
// Lê a chave de API do arquivo .env
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);