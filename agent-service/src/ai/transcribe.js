// Transcripción de audio (notas de voz de Telegram) usando Whisper de Groq.
// Requiere GROQ_API_KEY — independiente de qué proveedor uses para el modo lenguaje natural
// (podés usar Claude para el texto y Groq solo para transcribir, por ejemplo). Groq incluye
// esto en su tier gratis (con límite diario generoso).

import fs from 'fs'

const GROQ_KEY = process.env.GROQ_API_KEY

let groqClient = null
async function getGroqClient() {
  if (!groqClient) {
    const { default: Groq } = await import('groq-sdk')
    groqClient = new Groq({ apiKey: GROQ_KEY })
  }
  return groqClient
}

/** Devuelve el texto transcripto, o null si no hay GROQ_API_KEY configurada. */
export async function transcribeAudio(filePath) {
  if (!GROQ_KEY) return null
  const client = await getGroqClient()
  const MODEL = process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo'
  const result = await client.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: MODEL,
    language: 'es',
  })
  return result.text || ''
}
