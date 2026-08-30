function extractAnswer(rawText) {
  let text = typeof rawText === 'string' ? rawText.trim() : String(rawText);
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
        
        // Handle truncation that ends in a backslash
        if (answerString.endsWith('\\')) {
          answerString = answerString.slice(0, -1);
        }

        // Decode unicode and special chars manually
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
  return text;
}

const s1 = '{"answer": "\\u603b\\u7ed3...\\n\\u4e0b\\u5217\\';
console.log('Result:', extractAnswer(s1));
