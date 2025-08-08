// Test script to verify web search is working correctly
// Run with: node test-web-search.js

async function testWebSearch() {
  console.log('Testing Web Search Tool...\n');
  
  const queries = [
    'who is the US president in 2025',
    'latest OpenAI news',
    'current weather in San Francisco'
  ];
  
  for (const query of queries) {
    console.log(`\nSearching for: "${query}"`);
    console.log('-'.repeat(50));
    
    try {
      const response = await fetch('http://localhost:3000/api/tools/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolName: 'web_search',
          args: { query, maxResults: 3 },
          callId: `test-${Date.now()}`,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Success! Provider: ${result.metadata?.provider}`);
        console.log(`Found ${result.data?.results?.length || 0} results:\n`);
        
        result.data?.results?.forEach((r, i) => {
          console.log(`${i + 1}. ${r.title}`);
          console.log(`   ${r.snippet?.substring(0, 100)}...`);
          console.log(`   Source: ${r.source}`);
        });
      } else {
        console.log(`❌ Failed: ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('Test complete!');
}

testWebSearch().catch(console.error);