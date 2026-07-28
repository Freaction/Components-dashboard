import React from 'react'
import App from './App'
import { TokenProvider } from './context/TokenContext'
import { Providers } from './context/QueryProvider'
import './index.css' // Import tokens global styles
import './theme.css'

export function TokensDashboard() {
  return (
    <Providers>
      <TokenProvider>
        <App />
      </TokenProvider>
    </Providers>
  )
}
