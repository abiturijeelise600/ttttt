import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite app accepts the requested NEXT_PUBLIC_* environment variable names.
export default defineConfig({ envPrefix: ['VITE_', 'NEXT_PUBLIC_'], plugins: [react()] })
