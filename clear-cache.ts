import redis from './src/lib/redis';

async function clearCache() {
  const key = 'product:https://uk.gymshark.com/products/gymshark-element-baselayer-mock-neck-long-sleeve-t-shirt-ls-tops-1';

  console.log(`Clearing cache for key: ${key}`);
  const result = await redis.del(key);
  console.log(`✅ Deleted ${result} key(s)`);

  process.exit(0);
}

clearCache().catch(error => {
  console.error('Error clearing cache:', error);
  process.exit(1);
});
