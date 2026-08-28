// AI helper with graceful fallback when OpenAI key not configured
async function getAIResponse(prompt) {
  if (!process.env.OPENAI_API_KEY) {
    return 'AI features require an OpenAI API key. Add OPENAI_API_KEY to your .env file.';
  }
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500
  });
  return response.choices[0].message.content;
}

module.exports = { getAIResponse };
