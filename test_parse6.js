function extractAnswer(rawText) {
  if (!rawText) return "";
  if (typeof rawText === 'object') {
    if (rawText.answer) return rawText.answer;
    if (rawText.content && rawText.content.answer) return rawText.content.answer;
  }
  let text = typeof rawText === 'string' ? rawText.trim() : String(rawText);
  
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      for (let i = parsed.length - 1; i >= 0; i--) {
        const step = parsed[i];
        if (step && step.content) {
          if (typeof step.content === 'string' && step.content.startsWith('{')) {
            let inner = extractAnswer(step.content);
            if (inner && inner !== step.content) return inner;
          } else if (typeof step.content === 'object' && step.content.answer) {
            return step.content.answer;
          }
          if (typeof step.content === 'string') return step.content;
        }
        if (step && step.answer) return step.answer;
      }
    }
  } catch (e) {}
  return text;
}

const entryText = '[{"step_type": "FINAL", "content": {"answer": "\\u3054\\u8981\\u671b\\nLine2", "chunks": []}}]';
console.log('Result:', extractAnswer(entryText));
