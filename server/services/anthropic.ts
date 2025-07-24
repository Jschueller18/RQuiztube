import Anthropic from "@anthropic-ai/sdk";

export class AnthropicService {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("Anthropic API key not provided");
    }
    
    this.client = new Anthropic({ apiKey });
  }

  async generateQuestions(
    title: string,
    claudeOptimizedContent: string,
    category: string,
    count: number = 10,
    existingQuestions: string[] = []
  ): Promise<Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
    difficulty: string;
  }>> {
    const existingQuestionsText = existingQuestions.length > 0 
      ? `\nExisting questions to avoid duplicating:\n${existingQuestions.slice(0, 20).join('\n')}`
      : '';

    const prompt = `
You are an expert educational content creator specializing in creating effective learning assessments. Your task is to generate EXACTLY ${count} high-quality multiple-choice questions that focus on the MOST IMPORTANT and ACTIONABLE insights from the video content.

Video Title: ${title}
Category: ${category}

${claudeOptimizedContent}${existingQuestionsText}

CRITICAL REQUIREMENT: You MUST generate exactly ${count} questions. No more, no less. This is essential for the system to function properly.

IMPORTANT GUIDELINES:

Content Priority and Focus:
- Focus ONLY on the core concepts, key insights, and main learning objectives
- Target actionable knowledge that viewers can apply
- Identify and test the most important learnings from the video
- DO NOT create questions about trivial details like:
  * Names of guests, authors, or speakers
  * Specific dates or timestamps
  * Anecdotal examples (unless they're central to understanding a key concept)
  * Minor details that don't contribute to core learning
- Each question should test understanding of a significant concept or insight

Content Understanding:
- Only create questions about concepts that are EXPLICITLY explained in the video
- Do NOT make assumptions about meanings of acronyms or terms unless clearly defined
- Skip creating questions if the content is unclear or ambiguous
- Focus on testing comprehension and application, not memorization of details

Question Quality:
- Questions should challenge learners to think critically and apply concepts
- Target different cognitive levels (understanding, application, analysis)
- Make questions specific to the video's core messages and key takeaways
- Ensure questions are unambiguous and have a clear, definitive correct answer

Answer Options:
- All options must be plausible and related to the core concepts
- Make distractors challenging but clearly incorrect when compared to the right answer
- Avoid obvious wrong answers or joke options
- Options should be similar in length and grammatical structure
- Include common misconceptions as distractors when appropriate

Difficulty Levels:
- Easy: Tests understanding of main concepts and key messages
- Medium: Requires connecting multiple core concepts or applying key insights
- Hard: Involves analyzing relationships between major concepts or evaluating complex applications

${existingQuestions.length > 0 ? '- Avoid creating questions similar to the existing ones listed above\n' : ''}

Before creating each question, ask yourself:
1. Does this question test understanding of a CORE concept or key insight?
2. Will the answer help learners apply important knowledge?
3. Is this focused on what matters most from the video?
4. Am I avoiding trivial details and focusing on significant learning?

CRITICAL FORMATTING AND COUNT REQUIREMENTS:
- You MUST generate exactly ${count} questions in the JSON array
- Count your questions before responding to ensure you have exactly ${count}
- You must respond with EXACTLY formatted JSON. Do not add extra spaces, quotes, or characters. Here is the exact format required:

{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Explanation text here",
      "difficulty": "easy"
    }
  ]
}

Notes on JSON format:
- No extra spaces before or after quotes
- No extra quotes around property names or values
- No trailing commas
- Array elements separated by exactly one comma
- Use straight quotes (") not curly quotes
- Difficulty must be exactly "easy", "medium", or "hard"

FINAL REMINDER: Your response must contain exactly ${count} questions in the "questions" array. Before submitting your response, count the questions to verify you have exactly ${count}.

If you cannot generate ${count} high-quality questions that focus on core concepts and key insights, return exactly: {"questions": []}`;

    // Log prompt size for debugging
    const promptSize = prompt.length;
    const estimatedTokens = Math.ceil(promptSize / 4); // Rough estimate: 4 chars per token
    console.log(`Prompt size: ${promptSize} chars (~${estimatedTokens} tokens). Content: ${claudeOptimizedContent.length} chars`);

    try {
      console.log(`Attempting to generate questions for: ${title}`);
      
      // Retry logic with exponential backoff for API overload errors
      let retries = 0;
      const maxRetries = 3;
      let response;
      
      while (retries <= maxRetries) {
        try {
          response = await this.client.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 3000,
            system: "You are an expert educational content creator specializing in creating effective learning assessments. Focus ONLY on core concepts and key insights - avoid trivial details. You MUST generate the exact number of questions requested. You MUST respond with ONLY valid JSON in the exact format specified. Count your questions before responding to ensure the correct count.",
            messages: [
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.4,
          });
          break; // Success, exit retry loop
        } catch (apiError: any) {
          retries++;
          
          // Check if it's a retryable error (overloaded, rate limit, etc.)
          const isRetryable = apiError.status === 529 || // Overloaded
                             apiError.status === 503 || // Service unavailable
                             apiError.status === 500 || // Internal server error
                             apiError.status === 429;   // Rate limited
          
          if (!isRetryable || retries > maxRetries) {
            throw apiError; // Non-retryable error or max retries exceeded
          }
          
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, retries - 1) * 1000;
          console.log(`API error (${apiError.status}): ${apiError.message}. Retrying in ${delay}ms... (attempt ${retries}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (!response) {
        throw new Error("Failed to get response from Anthropic after retries");
      }

      console.log(`Got response from Anthropic for: ${title}`);
      let jsonText = response.content[0].text.trim();
      
      // Try to clean up common JSON formatting issues
      console.log('Original response:', jsonText);
      jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
      console.log('Cleaned response:', jsonText);
      
      try {
        const result = JSON.parse(jsonText);
        
        if (!result.questions || !Array.isArray(result.questions)) {
          console.error('Invalid response structure:', jsonText);
          throw new Error("Invalid response format from Anthropic - missing questions array");
        }

        // Validate and clean up each question
        const validatedQuestions = result.questions.map((q: any) => {
          if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || 
              typeof q.correctAnswer !== 'number' || !q.explanation || !q.difficulty) {
            console.error('Invalid question structure:', q);
            return null;
          }

          return {
            question: q.question.trim(),
            options: q.options.map((opt: string) => opt.trim()),
            correctAnswer: Math.max(0, Math.min(3, parseInt(String(q.correctAnswer)) || 0)),
            explanation: q.explanation.trim(),
            difficulty: ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium",
          };
        }).filter((q: any) => q !== null); // Remove any invalid questions

        console.log(`Successfully generated ${validatedQuestions.length} valid questions for: ${title} (requested: ${count})`);
        
        if (validatedQuestions.length !== count) {
          console.warn(`Question count mismatch for "${title}": generated ${validatedQuestions.length}, requested ${count}`);
        }
        
        return validatedQuestions;
        
      } catch (parseError) {
        console.error('Failed to parse Anthropic response as JSON:', jsonText);
        console.error('Parse error:', parseError);
        throw new Error("Failed to parse response as valid JSON");
      }
      
    } catch (error) {
      console.error("Error generating questions:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message);
        console.error("Error stack:", error.stack);
      }
      throw new Error("Failed to generate questions from content");
    }
  }

  // Remove the old calculateOptimalTranscriptLength method since content preparation is now handled by YouTube service

  async categorizeContent(title: string, description: string): Promise<string> {
    const prompt = `
Analyze this YouTube video content and respond with ONLY ONE of these exact category names (no other text):
- programming
- science  
- history
- business
- mathematics
- languages
- general

Title: ${title}
Description: ${description.substring(0, 500)}

IMPORTANT: Only categorize if you are confident about the content's primary focus. Default to "general" if unclear.`;

    try {
      // Retry logic with exponential backoff for API overload errors
      let retries = 0;
      const maxRetries = 3;
      let response;
      
      while (retries <= maxRetries) {
        try {
          response = await this.client.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 50,
            system: "You are a content categorization expert. Respond with ONLY the single most appropriate category name from the provided list. Use 'general' if uncertain.",
            messages: [
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.3,
          });
          break; // Success, exit retry loop
        } catch (apiError: any) {
          retries++;
          
          // Check if it's a retryable error (overloaded, rate limit, etc.)
          const isRetryable = apiError.status === 529 || // Overloaded
                             apiError.status === 503 || // Service unavailable
                             apiError.status === 500 || // Internal server error
                             apiError.status === 429;   // Rate limited
          
          if (!isRetryable || retries > maxRetries) {
            console.error("Non-retryable error in categorizeContent:", apiError);
            return "general"; // Fallback to general category on error
          }
          
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, retries - 1) * 1000;
          console.log(`Categorization API error (${apiError.status}): ${apiError.message}. Retrying in ${delay}ms... (attempt ${retries}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (!response) {
        console.error("Failed to get response from Anthropic for categorization");
        return "general";
      }

      const category = response.content[0].text?.trim().toLowerCase() || "general";
      const validCategories = ["programming", "science", "history", "business", "mathematics", "languages", "general"];
      
      return validCategories.includes(category) ? category : "general";
    } catch (error) {
      console.error("Error categorizing content:", error);
      return "general";
    }
  }
}
