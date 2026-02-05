// src/utils/markdown.js

/**
 * Convert Mattermost markdown to Slack markdown
 * @param {string} text - The Mattermost markdown text
 * @returns {string} - Converted Slack markdown
 */
function convertMattermostToSlack(text) {
  if (!text) return text;
  
  let converted = text;
  
  // Convert strikethrough first: ~~text~~ -> ~text~
  converted = converted.replace(/~~([^~\n]+?)~~/g, '~$1~');
  
  // Convert bold and italic in a single pass to avoid conflicts
  // Use placeholders to protect converted text
  const placeholders = [];
  
  // First handle **bold** -> *bold* and store with placeholder
  converted = converted.replace(/\*\*([^*\n]+?)\*\*/g, (match, p1) => {
    const placeholder = `\x00BOLD${placeholders.length}\x00`;
    placeholders.push(`*${p1}*`);
    return placeholder;
  });
  
  // Then handle *italic* -> _italic_
  converted = converted.replace(/\*([^*\n]+?)\*/g, '_$1_');
  
  // Restore bold placeholders
  converted = converted.replace(/\x00BOLD(\d+)\x00/g, (match, index) => {
    return placeholders[parseInt(index)];
  });
  
  // Convert links: [text](url) -> <url|text>
  converted = converted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');
  
  return converted;
}

/**
 * Convert Slack markdown to Mattermost markdown
 * @param {string} text - The Slack markdown text
 * @returns {string} - Converted Mattermost markdown
 */
function convertSlackToMattermost(text) {
  if (!text) return text;
  
  let converted = text;
  
  // Convert channel mentions first: <#CHANNEL_ID|name> -> ~name
  converted = converted.replace(/<#[^|>]+\|([^>]+)>/g, '~$1');
  
  // Convert channel mentions without name: <#CHANNEL_ID> -> #CHANNEL_ID
  converted = converted.replace(/<#([^>]+)>/g, '#$1');
  
  // Convert Slack links: <url|text> -> [text](url)
  converted = converted.replace(/<([^|>]+)\|([^>]+)>/g, '[$2]($1)');
  
  // Convert Slack links without text: <url> -> url
  converted = converted.replace(/<(https?:\/\/[^>]+)>/g, '$1');
  
  // Convert strikethrough: ~text~ -> ~~text~~
  // Use negative lookbehind to avoid matching already doubled tildes (requires Node.js 9.0+)
  converted = converted.replace(/(?<!~)~([^~\n]+?)~(?!~)/g, '~~$1~~');
  
  // Convert bold: *text* -> **text**
  // Use negative lookbehind to avoid list markers (requires Node.js 9.0+)
  converted = converted.replace(/(?<![*\s])\*([^*\n]+?)\*(?![*])/g, '**$1**');
  
  // Convert italic: _text_ -> *text*
  // Use negative lookbehind to avoid matching already doubled underscores (requires Node.js 9.0+)
  converted = converted.replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '*$1*');
  
  // Convert user mentions: <@USER_ID> -> @USER_ID (simplified)
  converted = converted.replace(/<@([^>]+)>/g, '@$1');
  
  return converted;
}

module.exports = {
  convertMattermostToSlack,
  convertSlackToMattermost,
};
