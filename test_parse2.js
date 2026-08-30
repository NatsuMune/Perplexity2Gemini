function extractAnswer(rawText) {
  let text = typeof rawText === 'string' ? rawText.trim() : String(rawText);
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      for (let i = parsed.length - 1; i >= 0; i--) {
        const step = parsed[i];
        if (step && step.content && step.content.answer) return step.content.answer;
        if (step && typeof step.content === 'string' && step.content) return step.content;
        if (step && step.answer) return step.answer;
      }
    } else if (typeof parsed === 'object' && parsed !== null) {
      if (parsed.answer) return parsed.answer;
      if (parsed.content && parsed.content.answer) return parsed.content.answer;
    }
  } catch (e) {}

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
        if (endIndex !== -1) {
          let answerString = text.substring(quoteIndex + 1, endIndex);
          let safeString = answerString
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
          try {
            return JSON.parse('"' + safeString + '"');
          } catch (err) {
            return answerString;
          }
        } else {
          console.log("NO END INDEX FOUND");
        }
      } else {
        console.log("NO QUOTE INDEX");
      }
    } else {
      console.log("NO COLON INDEX");
    }
  } else {
    console.log("NO START INDEX");
  }
  return text;
}

const sample1 = '{"answer": "## \\u603b\\u7ed3...\\n\\u4e0b\\u5217...", "web_results": []}';
console.log('Result:', extractAnswer(sample1));
