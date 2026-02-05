// __tests__/utils/sharding.test.js
jest.mock('../../src/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

const {
  initializeSharding,
  getChannelShard,
  shouldHandleChannel,
  filterChannelMappingsForShard,
  getShardConfig,
  getShardHealth,
  registerChannelAssignment,
  getChannelAssignments
} = require('../../src/utils/sharding');

describe('sharding', () => {
  beforeEach(() => {
    // Reset to default state
    initializeSharding({ enabled: false });
  });

  describe('initializeSharding', () => {
    test('should initialize with sharding disabled by default', () => {
      initializeSharding();
      const config = getShardConfig();
      expect(config.enabled).toBe(false);
      expect(config.shardId).toBe(0);
      expect(config.totalShards).toBe(1);
    });

    test('should initialize with sharding enabled', () => {
      initializeSharding({
        enabled: true,
        shardId: 2,
        totalShards: 5
      });
      
      const config = getShardConfig();
      expect(config.enabled).toBe(true);
      expect(config.shardId).toBe(2);
      expect(config.totalShards).toBe(5);
    });

    test('should throw error for invalid shard ID', () => {
      expect(() => {
        initializeSharding({
          enabled: true,
          shardId: 5,
          totalShards: 5
        });
      }).toThrow('Invalid shard ID: 5 (must be < 5)');
    });

    test('should throw error for invalid total shards', () => {
      expect(() => {
        initializeSharding({
          enabled: true,
          shardId: 0,
          totalShards: 0
        });
      }).toThrow('Invalid total shards: 0 (must be >= 1)');
    });
  });

  describe('getChannelShard', () => {
    test('should return 0 when sharding is disabled', () => {
      initializeSharding({ enabled: false });
      expect(getChannelShard('C12345')).toBe(0);
      expect(getChannelShard('C67890')).toBe(0);
    });

    test('should consistently assign same channel to same shard', () => {
      initializeSharding({
        enabled: true,
        shardId: 0,
        totalShards: 3
      });
      
      const channelId = 'C12345TEST';
      const shard1 = getChannelShard(channelId);
      const shard2 = getChannelShard(channelId);
      
      expect(shard1).toBe(shard2);
      expect(shard1).toBeGreaterThanOrEqual(0);
      expect(shard1).toBeLessThan(3);
    });

    test('should distribute channels across shards', () => {
      initializeSharding({
        enabled: true,
        shardId: 0,
        totalShards: 3
      });
      
      const channels = [
        'C001', 'C002', 'C003', 'C004', 'C005',
        'C006', 'C007', 'C008', 'C009', 'C010'
      ];
      
      const shardCounts = { 0: 0, 1: 0, 2: 0 };
      channels.forEach(channelId => {
        const shard = getChannelShard(channelId);
        shardCounts[shard]++;
      });
      
      // All shards should have at least one channel (with high probability)
      // We won't enforce exact distribution as it's based on hashing
      expect(shardCounts[0]).toBeGreaterThan(0);
      expect(shardCounts[1]).toBeGreaterThan(0);
      expect(shardCounts[2]).toBeGreaterThan(0);
    });
  });

  describe('shouldHandleChannel', () => {
    test('should return true for all channels when sharding disabled', () => {
      initializeSharding({ enabled: false });
      expect(shouldHandleChannel('C001')).toBe(true);
      expect(shouldHandleChannel('C002')).toBe(true);
      expect(shouldHandleChannel('C003')).toBe(true);
    });

    test('should return true only for channels assigned to this shard', () => {
      initializeSharding({
        enabled: true,
        shardId: 1,
        totalShards: 3
      });
      
      const channels = [
        'C001', 'C002', 'C003', 'C004', 'C005',
        'C006', 'C007', 'C008', 'C009', 'C010'
      ];
      
      const handledChannels = channels.filter(ch => shouldHandleChannel(ch));
      const notHandledChannels = channels.filter(ch => !shouldHandleChannel(ch));
      
      expect(handledChannels.length).toBeGreaterThan(0);
      expect(notHandledChannels.length).toBeGreaterThan(0);
      
      // Verify consistency
      handledChannels.forEach(ch => {
        expect(getChannelShard(ch)).toBe(1);
      });
    });
  });

  describe('filterChannelMappingsForShard', () => {
    test('should return all mappings when sharding disabled', () => {
      initializeSharding({ enabled: false });
      
      const mappings = [
        { slack: 'C001', mattermost: 'mm001' },
        { slack: 'C002', mattermost: 'mm002' },
        { slack: 'C003', mattermost: 'mm003' }
      ];
      
      const filtered = filterChannelMappingsForShard(mappings);
      expect(filtered).toHaveLength(3);
      expect(filtered).toEqual(mappings);
    });

    test('should filter mappings for current shard', () => {
      initializeSharding({
        enabled: true,
        shardId: 0,
        totalShards: 2
      });
      
      const mappings = [
        { slack: 'C001', mattermost: 'mm001' },
        { slack: 'C002', mattermost: 'mm002' },
        { slack: 'C003', mattermost: 'mm003' },
        { slack: 'C004', mattermost: 'mm004' }
      ];
      
      const filtered = filterChannelMappingsForShard(mappings);
      
      // Should get roughly half the channels
      expect(filtered.length).toBeLessThan(mappings.length);
      expect(filtered.length).toBeGreaterThan(0);
      
      // All filtered channels should belong to shard 0
      filtered.forEach(mapping => {
        expect(getChannelShard(mapping.slack)).toBe(0);
      });
    });

    test('should handle empty mappings array', () => {
      initializeSharding({
        enabled: true,
        shardId: 0,
        totalShards: 3
      });
      
      const filtered = filterChannelMappingsForShard([]);
      expect(filtered).toEqual([]);
    });
  });

  describe('getShardConfig', () => {
    test('should return current configuration', () => {
      initializeSharding({
        enabled: true,
        shardId: 3,
        totalShards: 10
      });
      
      const config = getShardConfig();
      expect(config).toEqual({
        enabled: true,
        shardId: 3,
        totalShards: 10
      });
    });
  });

  describe('getShardHealth', () => {
    test('should return health status', () => {
      initializeSharding({
        enabled: true,
        shardId: 1,
        totalShards: 5
      });
      
      const health = getShardHealth();
      expect(health.shardId).toBe(1);
      expect(health.totalShards).toBe(5);
      expect(health.enabled).toBe(true);
      expect(health.status).toBe('healthy');
      expect(health.channelsHandled).toBe(0);
    });
  });

  describe('registerChannelAssignment and getChannelAssignments', () => {
    test('should register and retrieve channel assignments', () => {
      initializeSharding({
        enabled: true,
        shardId: 0,
        totalShards: 2
      });
      
      registerChannelAssignment('C001');
      registerChannelAssignment('C002');
      registerChannelAssignment('C003');
      
      const assignments = getChannelAssignments();
      expect(assignments).toHaveLength(3);
      expect(assignments).toContain('C001');
      expect(assignments).toContain('C002');
      expect(assignments).toContain('C003');
      
      const health = getShardHealth();
      expect(health.channelsHandled).toBe(3);
    });

    test('should not register when sharding disabled', () => {
      initializeSharding({ enabled: false });
      
      registerChannelAssignment('C001');
      
      const assignments = getChannelAssignments();
      expect(assignments).toHaveLength(0);
    });

    test('should handle duplicate registrations', () => {
      initializeSharding({
        enabled: true,
        shardId: 0,
        totalShards: 2
      });
      
      registerChannelAssignment('C001');
      registerChannelAssignment('C001');
      registerChannelAssignment('C001');
      
      const assignments = getChannelAssignments();
      expect(assignments).toHaveLength(1);
      expect(assignments[0]).toBe('C001');
    });
  });
});
