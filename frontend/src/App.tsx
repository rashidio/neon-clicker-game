import React, { useState } from 'react'
import NeonClickerGame from './NeonClickerGame'

export default function App() {
  const [score, setScore] = useState(0)

  return (
    <NeonClickerGame/>
  )
}