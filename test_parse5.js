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
    } else if (typeof parsed === 'object' && parsed !== null) {
      if (parsed.answer) return parsed.answer;
      if (parsed.content && parsed.content.answer) return parsed.content.answer;
      if (parsed.text) return extractAnswer(parsed.text);
    }
  } catch (e) {
    let startIndex = text.indexOf('"answer"');
    if (startIndex !== -1) {
      let colonIndex = text.indexOf(':', startIndex);
      if (colonIndex !== -1) {
        let quoteIndex = text.indexOf('"', colonIndex);
        if (quoteIndex !== -1) {
          let endIndex = -1;
          for (let i = quoteIndex + 1; i < text.length; i++) {
            if (text[i] === '"') {
              let backslashes = 0;
              let j = i - 1;
              while (j >= 0 && text[j] === '\\') {
                backslashes++;
                j--;
              }
              if (backslashes % 2 === 0) {
                endIndex = i;
                break;
              }
            }
          }
          
          let answerString = text.substring(quoteIndex + 1, endIndex !== -1 ? endIndex : text.length);
          
          if (answerString.endsWith('\\')) {
            answerString = answerString.slice(0, -1);
          }
          
          let decoded = answerString
            .replace(/\\u([0-9a-fA-F]{4})/g, (m, grp) => String.fromCharCode(parseInt(grp, 16)))
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
            
          return decoded;
        }
      }
    }
  }
  return text;
}

// Simulate the exact object from Perplexity API
const entryText = '[{"step_type": "FINAL", "content": "{\\"answer\\": \\"\\\\u3054\\\\u8981\\\\u671b\\\\nLine2\\", \\"chunks\\": []}"}]';

// Check what extractAnswer returns
console.log('Result:', extractAnswer(entryText));
