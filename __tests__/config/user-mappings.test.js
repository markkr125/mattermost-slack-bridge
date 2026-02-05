// __tests__/config/user-mappings.test.js

describe('User Mappings', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    // Clear environment variables
    delete process.env.SLACK_USER_MAPPINGS;
    delete process.env.MM_USER_MAPPINGS;
  });

  test('should parse Slack user mappings', () => {
    process.env.SLACK_USER_MAPPINGS = JSON.stringify({
      'U12345': {
        mm_user_id: 'abc123',
        display_name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg'
      }
    });

    const { getSlackUserMapping, parseUserMappings } = require('../../src/config/user-mappings');
    
    const mappings = parseUserMappings();
    expect(mappings.slackToMattermost.size).toBe(1);
    
    const mapping = getSlackUserMapping('U12345');
    expect(mapping).toEqual({
      mmUserId: 'abc123',
      displayName: 'John Doe',
      avatarUrl: 'https://example.com/avatar.jpg'
    });
  });

  test('should parse Mattermost user mappings', () => {
    process.env.MM_USER_MAPPINGS = JSON.stringify({
      'abc123': {
        slack_user_id: 'U12345',
        display_name: 'Jane Smith',
        avatar_url: 'https://example.com/avatar2.jpg'
      }
    });

    const { getMattermostUserMapping, parseUserMappings } = require('../../src/config/user-mappings');
    
    const mappings = parseUserMappings();
    expect(mappings.mattermostToSlack.size).toBe(1);
    
    const mapping = getMattermostUserMapping('abc123');
    expect(mapping).toEqual({
      slackUserId: 'U12345',
      displayName: 'Jane Smith',
      avatarUrl: 'https://example.com/avatar2.jpg'
    });
  });

  test('should return null for unmapped Slack users', () => {
    process.env.SLACK_USER_MAPPINGS = '{}';
    
    const { getSlackUserMapping } = require('../../src/config/user-mappings');
    
    const mapping = getSlackUserMapping('U99999');
    expect(mapping).toBeNull();
  });

  test('should return null for unmapped Mattermost users', () => {
    process.env.MM_USER_MAPPINGS = '{}';
    
    const { getMattermostUserMapping } = require('../../src/config/user-mappings');
    
    const mapping = getMattermostUserMapping('xyz999');
    expect(mapping).toBeNull();
  });

  test('should handle multiple user mappings', () => {
    process.env.SLACK_USER_MAPPINGS = JSON.stringify({
      'U12345': {
        mm_user_id: 'abc123',
        display_name: 'John Doe',
        avatar_url: 'https://example.com/avatar1.jpg'
      },
      'U67890': {
        mm_user_id: 'def456',
        display_name: 'Jane Smith',
        avatar_url: 'https://example.com/avatar2.jpg'
      }
    });

    const { getSlackUserMapping, parseUserMappings } = require('../../src/config/user-mappings');
    
    const mappings = parseUserMappings();
    expect(mappings.slackToMattermost.size).toBe(2);
    
    const mapping1 = getSlackUserMapping('U12345');
    expect(mapping1.displayName).toBe('John Doe');
    
    const mapping2 = getSlackUserMapping('U67890');
    expect(mapping2.displayName).toBe('Jane Smith');
  });

  test('should handle invalid JSON gracefully', () => {
    process.env.SLACK_USER_MAPPINGS = 'invalid json';
    
    const { parseUserMappings } = require('../../src/config/user-mappings');
    
    const mappings = parseUserMappings();
    expect(mappings.slackToMattermost.size).toBe(0);
  });

  test('should handle empty mappings', () => {
    const { getSlackUserMapping, getMattermostUserMapping } = require('../../src/config/user-mappings');
    
    expect(getSlackUserMapping('U12345')).toBeNull();
    expect(getMattermostUserMapping('abc123')).toBeNull();
  });

  test('should support partial mapping data', () => {
    process.env.SLACK_USER_MAPPINGS = JSON.stringify({
      'U12345': {
        mm_user_id: 'abc123',
        display_name: 'John Doe'
        // No avatar_url
      }
    });

    const { getSlackUserMapping } = require('../../src/config/user-mappings');
    
    const mapping = getSlackUserMapping('U12345');
    expect(mapping.displayName).toBe('John Doe');
    expect(mapping.avatarUrl).toBeUndefined();
  });
});
