import React from 'react'

const goldGradient = 'linear-gradient(135deg, #DEBB67 0%, #FDD78A 50%, #DEBB67 100%)'
const blueGradient = 'linear-gradient(135deg, #1F3453 0%, #3B5786 50%, #1F3453 100%)'
const purpleGradient = 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 50%, #7C3AED 100%)'

export function AnalysisIcon() {
  return (
    <div 
      className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md"
      style={{ background: goldGradient }}
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2"/>
        <path d="M12 2v3M12 19v3M22 12h-3M5 12H2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        <path d="M19.07 4.93l-2.12 2.12M7.05 16.95l-2.12 2.12M19.07 19.07l-2.12-2.12M7.05 7.05L4.93 4.93" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    </div>
  )
}

export function DiagnosticIcon() {
  return (
    <div 
      className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md"
      style={{ background: blueGradient }}
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

export function SolutionsIcon() {
  return (
    <div 
      className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md"
      style={{ background: purpleGradient }}
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2"/>
        <circle cx="12" cy="12" r="8" stroke="white" strokeWidth="2"/>
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    </div>
  )
}
