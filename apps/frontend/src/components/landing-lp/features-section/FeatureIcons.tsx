import React from 'react'

const blueGradient = 'linear-gradient(135deg, #1F3453 0%, #3B5786 50%, #1F3453 100%)'

export function DocumentIcon() {
  return (
    <div 
      className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: blueGradient }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 2v4M15 2v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        <rect x="4" y="5" width="16" height="16" rx="2" stroke="white" strokeWidth="2"/>
        <path d="M8 10h8M8 14h5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
  )
}

export function DiagnosticIcon() {
  return (
    <div 
      className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: blueGradient }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="8" r="2" fill="white"/>
        <circle cx="8" cy="14" r="2" fill="white"/>
        <circle cx="16" cy="14" r="2" fill="white"/>
        <circle cx="12" cy="19" r="2" fill="white"/>
        <path d="M12 10v7M10 14l2-4M14 14l-2-4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
  )
}

export function TelemedIcon() {
  return (
    <div 
      className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: blueGradient }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="6" width="13" height="10" rx="1.5" stroke="white" strokeWidth="2"/>
        <path d="M16 10l4-2v8l-4-2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="7.5" cy="11" r="1.5" fill="white"/>
      </svg>
    </div>
  )
}

export function BrainAIIcon() {
  return (
    <div 
      className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: blueGradient }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="6" width="5" height="5" rx="1" stroke="white" strokeWidth="2"/>
        <rect x="13" y="6" width="5" height="5" rx="1" stroke="white" strokeWidth="2"/>
        <rect x="6" y="13" width="5" height="5" rx="1" stroke="white" strokeWidth="2"/>
        <rect x="13" y="13" width="5" height="5" rx="1" stroke="white" strokeWidth="2"/>
        <circle cx="8.5" cy="8.5" r="0.8" fill="white"/>
        <circle cx="15.5" cy="8.5" r="0.8" fill="white"/>
        <path d="M8.5 11v2M15.5 11v2" stroke="white" strokeWidth="1.5"/>
      </svg>
    </div>
  )
}

export function BookIcon() {
  return (
    <div 
      className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: blueGradient }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        <path d="M6.5 3H20v16H6.5A2.5 2.5 0 0 1 4 16.5v-11A2.5 2.5 0 0 1 6.5 3z" stroke="white" strokeWidth="2"/>
        <path d="M12 3v16" stroke="white" strokeWidth="1.5"/>
      </svg>
    </div>
  )
}

export function ToolIcon() {
  return (
    <div 
      className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: blueGradient }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="7" y="9" width="10" height="12" rx="3" stroke="white" strokeWidth="2"/>
        <circle cx="12" cy="15" r="2" stroke="white" strokeWidth="1.5"/>
        <path d="M10 9V7a2 2 0 0 1 4 0v2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    </div>
  )
}
