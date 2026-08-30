function extractAnswer(rawText) {
  let text = typeof rawText === 'string' ? rawText.trim() : String(rawText);
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      for (let i = parsed.length - 1; i >= 0; i--) {
        const step = parsed[i];
        if (step && step.content) {
          if (typeof step.content === 'string') {
            try {
              let innerParsed = JSON.parse(step.content);
              if (innerParsed.answer) return innerParsed.answer;
            } catch(e) {}
            return step.content;
          } else if (step.content.answer) {
            return step.content.answer;
          }
        }
        if (step && step.answer) return step.answer;
      }
    }
  } catch (e) {}
  return text;
}

const s1 = '[{"content": "{\\"answer\\": \\"\\u3054\\u8981\\u671b\\nline2\\"}"}]';
console.log('Result:', extractAnswer(s1));
