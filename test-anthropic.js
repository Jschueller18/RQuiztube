const { OpenAIService } = require('./server/services/openai');

async function testAnthropicService() {
  try {
    const service = new OpenAIService();

    // Test content categorization
    console.log('\nTesting content categorization...');
    const title = "Introduction to Python Programming for Beginners";
    const description = "Learn the basics of Python programming in this comprehensive tutorial. We'll cover variables, functions, loops, and basic data structures.";
    
    const category = await service.categorizeContent(title, description);
    console.log('Category result:', category);
    console.log('Categorization test completed successfully');

    // Test question generation
    console.log('\nTesting question generation...');
    const transcript = `
      In this tutorial, we'll learn about Python programming basics.
      First, we'll cover variables. Variables are containers for storing data values.
      Python has several data types: numbers, strings, lists, and dictionaries.
      Then we'll look at functions. Functions are reusable blocks of code that perform specific tasks.
      Finally, we'll explore loops, which help us repeat actions multiple times efficiently.
    `;

    const questions = await service.generateQuestions(title, transcript, category, 2);
    console.log('Generated questions:', JSON.stringify(questions, null, 2));
    console.log('Question generation test completed successfully');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the tests
testAnthropicService(); 