// __tests__/utils/markdown.test.js
const { convertMattermostToSlack, convertSlackToMattermost } = require('../../src/utils/markdown');

describe('Markdown Conversion', () => {
  describe('convertMattermostToSlack', () => {
    test('should convert strikethrough from ~~text~~ to ~text~', () => {
      expect(convertMattermostToSlack('~~strikethrough~~')).toBe('~strikethrough~');
    });

    test('should convert bold from **text** to *text*', () => {
      expect(convertMattermostToSlack('**bold**')).toBe('*bold*');
    });

    test('should convert italic from *text* to _text_', () => {
      expect(convertMattermostToSlack('*italic*')).toBe('_italic_');
    });

    test('should convert links from [text](url) to <url|text>', () => {
      expect(convertMattermostToSlack('[Google](https://google.com)')).toBe('<https://google.com|Google>');
    });

    test('should handle mixed formatting correctly', () => {
      expect(convertMattermostToSlack('**bold** and *italic* with [link](https://example.com)'))
        .toBe('*bold* and _italic_ with <https://example.com|link>');
    });

    test('should handle null or undefined text', () => {
      expect(convertMattermostToSlack(null)).toBeNull();
      expect(convertMattermostToSlack(undefined)).toBeUndefined();
    });

    test('should handle empty string', () => {
      expect(convertMattermostToSlack('')).toBe('');
    });

    test('should preserve text without formatting', () => {
      expect(convertMattermostToSlack('plain text')).toBe('plain text');
    });
  });

  describe('convertSlackToMattermost', () => {
    test('should convert channel mentions <#CHANNEL_ID|name> to ~name', () => {
      expect(convertSlackToMattermost('<#C12345|general>')).toBe('~general');
    });

    test('should convert channel mentions <#CHANNEL_ID> to #CHANNEL_ID', () => {
      expect(convertSlackToMattermost('<#C12345>')).toBe('#C12345');
    });

    test('should convert links from <url|text> to [text](url)', () => {
      expect(convertSlackToMattermost('<https://google.com|Google>')).toBe('[Google](https://google.com)');
    });

    test('should convert links from <url> to url', () => {
      expect(convertSlackToMattermost('<https://google.com>')).toBe('https://google.com');
    });

    test('should convert strikethrough from ~text~ to ~~text~~', () => {
      expect(convertSlackToMattermost('~strikethrough~')).toBe('~~strikethrough~~');
    });

    test('should convert bold from *text* to **text**', () => {
      expect(convertSlackToMattermost('*bold*')).toBe('**bold**');
    });

    test('should convert italic from _text_ to *text*', () => {
      expect(convertSlackToMattermost('_italic_')).toBe('*italic*');
    });

    test('should convert user mentions from <@USER_ID> to @USER_ID', () => {
      expect(convertSlackToMattermost('<@U12345>')).toBe('@U12345');
    });

    test('should handle mixed formatting correctly', () => {
      expect(convertSlackToMattermost('*bold* and _italic_ with <https://example.com|link>'))
        .toBe('**bold** and *italic* with [link](https://example.com)');
    });

    test('should handle null or undefined text', () => {
      expect(convertSlackToMattermost(null)).toBeNull();
      expect(convertSlackToMattermost(undefined)).toBeUndefined();
    });

    test('should handle empty string', () => {
      expect(convertSlackToMattermost('')).toBe('');
    });

    test('should preserve text without formatting', () => {
      expect(convertSlackToMattermost('plain text')).toBe('plain text');
    });
  });

  describe('Round-trip conversions', () => {
    test('should handle converting back and forth for basic text', () => {
      const original = 'plain text';
      const toSlack = convertMattermostToSlack(original);
      const backToMm = convertSlackToMattermost(toSlack);
      expect(backToMm).toBe(original);
    });
  });
});
