import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// This Vite app accepts the public NEXT_PUBLIC_* variable names.
export default defineConfig({ envPrefix: ['VITE_', 'NEXT_PUBLIC_'], plugins: [react()] })
