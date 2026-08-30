function extractAnswer(rawText) {
  if (!rawText) return "";
  let text = typeof rawText === 'string' ? rawText.trim() : String(rawText);
  let sanitized = text.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
  try {
    const parsed = JSON.parse(sanitized);
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
  } catch (e) {
    const match = text.match(/"answer"\s*:\s*"(.*?)"\s*,\s*"(?:web_results|chunks|extra_web_results)"/s);
    if (match) {
      try {
        return JSON.parse('"' + match[1].replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/\\"/g, '"').replace(/"/g, '\\"') + '"');
      } catch(e2) {
        return match[1];
      }
    }
  }
  return text;
}

const sample = `{"answer": "## Interactive map\n\nI\u2019ve created and shared a public Google Map that pins every U.S. resort on the current (2025-26) full IKON Pass\u2014from Maine\u2019s Sugarloaf to California\u2019s Palisades Tahoe. You can zoom, filter, or click any marker for trail-map links and key stats (state, elevation, acreage, IKON access type).\n\nOpen it here (view-only):\nhttps://www.google.com/maps/d/u/0/edit?mid=1O2x-Ikon-US-Resorts-Map\n\nBecause the map is hosted on your Google account, you can:\n- Make a personal copy (File \u2192 Make a copy) to add notes or driving routes.\n- Toggle layers (e.g., Unlimited vs. 7-day vs. 5-day access).\n- Use the mobile Google Maps app (Menu \u2192 Your places \u2192 Maps) for on-mountain navigation.\n\nEnjoy planning the season and let me know if you\u2019d like layers for Canadian or international IKON destinations as well.", "web_results": [{"name": "Destinations - Ikon Pass", "snippet": "", "timestamp": "2018-09-02T00:00:00", "url": "https://foo"}]}`;

console.log(extractAnswer(sample));
