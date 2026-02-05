#!/usr/bin/env node
// tools/benchmark-cli.js
/**
 * Performance benchmarking CLI tool for the Mattermost-Slack Bridge
 * 
 * Usage:
 *   node tools/benchmark-cli.js --scenario <scenario> --iterations <n>
 * 
 * Scenarios:
 *   - message-processing: Benchmark message processing throughput
 *   - concurrent: Test concurrent message handling
 *   - all: Run all benchmarks
 */

const { PerformanceMonitor } = require('../src/utils/perf-monitor');
const { MessageProcessor } = require('../src/utils/message-processor');

const monitor = new PerformanceMonitor();

/**
 * Simulate message processing
 */
async function simulateMessageProcessing(count = 100) {
  console.log(`\n📊 Benchmarking message processing (${count} iterations)...\n`);
  
  for (let i = 0; i < count; i++) {
    await monitor.track('message-processing', async () => {
      // Simulate markdown conversion
      const text = 'Hello *world* with _formatting_ and [links](http://example.com)';
      const converted = text.replace(/\*/g, '**').replace(/_/g, '*');
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      
      return converted;
    });
  }
  
  const stats = monitor.analyze('message-processing');
  displayStats('Message Processing', stats);
}

/**
 * Benchmark concurrent processing
 */
async function benchmarkConcurrent(poolSize = 10, messageCount = 100) {
  console.log(`\n📊 Benchmarking concurrent processing (pool size: ${poolSize}, messages: ${messageCount})...\n`);
  
  const processor = new MessageProcessor({ maxConcurrent: poolSize, name: 'benchmark' });
  
  const measurementId = monitor.begin('concurrent-processing');
  
  const promises = [];
  for (let i = 0; i < messageCount; i++) {
    promises.push(
      processor.submit(async () => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
        return i;
      })
    );
  }
  
  await Promise.all(promises);
  
  monitor.complete(measurementId);
  
  const processorStats = processor.snapshot();
  console.log('Processor Statistics:');
  console.log(`  Total completed: ${processorStats.completed}`);
  console.log(`  Total errors: ${processorStats.errors}`);
  console.log(`  Average duration: ${processorStats.averageDurationMs.toFixed(2)}ms`);
  console.log(`  Peak queue depth: ${processorStats.peakWaiting}`);
  
  const perfStats = monitor.analyze('concurrent-processing');
  displayStats('Concurrent Processing', perfStats);
}

/**
 * Benchmark file operations simulation
 */
async function benchmarkFileOps(count = 50) {
  console.log(`\n📊 Benchmarking file operations (${count} iterations)...\n`);
  
  for (let i = 0; i < count; i++) {
    await monitor.track('file-operation', async () => {
      // Simulate file processing
      const fileSize = Math.random() * 1024 * 1024; // Up to 1MB
      const buffer = Buffer.alloc(Math.floor(fileSize));
      
      // Simulate upload delay based on size
      const delayMs = (fileSize / (1024 * 100)); // 100KB/ms simulated speed
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      return buffer.length;
    });
  }
  
  const stats = monitor.analyze('file-operation');
  displayStats('File Operations', stats);
}

/**
 * Display statistics in formatted output
 */
function displayStats(title, stats) {
  if (!stats) {
    console.log(`No stats available for ${title}`);
    return;
  }
  
  console.log(`\n${title} Results:`);
  console.log('━'.repeat(50));
  console.log(`  Samples: ${stats.sampleCount}`);
  console.log(`\n  Timing (ms):`);
  console.log(`    Min:    ${stats.timing.minMs.toFixed(3)}`);
  console.log(`    Max:    ${stats.timing.maxMs.toFixed(3)}`);
  console.log(`    Mean:   ${stats.timing.meanMs.toFixed(3)}`);
  console.log(`    Median: ${stats.timing.medianMs.toFixed(3)}`);
  console.log(`    P90:    ${stats.timing.p90Ms.toFixed(3)}`);
  console.log(`    P95:    ${stats.timing.p95Ms.toFixed(3)}`);
  console.log(`    P99:    ${stats.timing.p99Ms.toFixed(3)}`);
  console.log(`\n  Memory (heap):`);
  console.log(`    Min: ${formatBytes(stats.memory.minBytes)}`);
  console.log(`    Max: ${formatBytes(stats.memory.maxBytes)}`);
  console.log(`    Avg: ${formatBytes(stats.memory.avgBytes)}`);
  console.log('━'.repeat(50));
}

/**
 * Format bytes
 */
function formatBytes(bytes) {
  const absBytes = Math.abs(bytes);
  if (absBytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(absBytes) / Math.log(k)), sizes.length - 1);
  const value = bytes / Math.pow(k, i);
  
  return `${value.toFixed(2)} ${sizes[i]}`;
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    scenario: 'all',
    iterations: 100,
    poolSize: 10
  };
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];
    
    if (key === 'scenario') {
      options.scenario = value;
    } else if (key === 'iterations') {
      options.iterations = parseInt(value, 10);
    } else if (key === 'pool-size') {
      options.poolSize = parseInt(value, 10);
    }
  }
  
  return options;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Mattermost-Slack Bridge Performance Benchmarks\n');
  console.log('='.repeat(50));
  
  const options = parseArgs();
  
  const startTime = Date.now();
  
  try {
    if (options.scenario === 'all' || options.scenario === 'message-processing') {
      await simulateMessageProcessing(options.iterations);
    }
    
    if (options.scenario === 'all' || options.scenario === 'concurrent') {
      await benchmarkConcurrent(options.poolSize, options.iterations);
    }
    
    if (options.scenario === 'all' || options.scenario === 'file-ops') {
      await benchmarkFileOps(Math.floor(options.iterations / 2));
    }
    
    const totalTime = Date.now() - startTime;
    
    console.log('\n\n📈 Benchmark Summary');
    console.log('='.repeat(50));
    console.log(`Total benchmark time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log('\nFull report:');
    console.log(monitor.report());
    
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().then(() => {
    console.log('\n✅ Benchmarks completed successfully\n');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main };
