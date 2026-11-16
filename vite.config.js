import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Vite exposes only the intended public environment variables to browser code.
export default defineConfig({ envPrefix: ['VITE_', 'NEXT_PUBLIC_'], plugins: [react()] })
