const Anthropic = require('@anthropic-ai/sdk');

async function testAnthropicAPI() {
  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    console.log('Testing Anthropic API connection...');
    
    const response = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: "Please respond with 'Hello! I am Claude Haiku and I am working correctly!'"
        }
      ]
    });

    console.log('Response:', response.content[0].text);
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAnthropicAPI(); 