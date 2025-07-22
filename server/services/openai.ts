import Anthropic from "@anthropic-ai/sdk";

export class OpenAIService {
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
    transcript: string,
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
You are an expert educational content creator specializing in creating effective learning assessments. Your task is to generate high-quality multiple-choice questions that focus on the MOST IMPORTANT and ACTIONABLE insights from the video content.

Video Title: ${title}
Category: ${category}
Transcript/Content: ${transcript.substring(0, 4000)}${existingQuestionsText}

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

IMPORTANT: Your response must be a valid JSON object with this EXACT structure:
{
  "questions": [
    {
      "question": "Clear, focused question about a core concept or key insight?",
      "options": ["Plausible option A", "Plausible option B", "Plausible option C", "Plausible option D"],
      "correctAnswer": 0,
      "explanation": "Detailed explanation of why the correct answer represents the key learning and why other options are incorrect",
      "difficulty": "easy|medium|hard"
    }
  ]
}

If you cannot generate high-quality questions that focus on core concepts and key insights, return an empty questions array: {"questions": []}. Do not create questions about trivial details just to meet the count.`;

    try {
      const response = await this.client.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 3000,
        messages: [
          {
            role: "system",
            content: "You are an expert educational content creator specializing in creating effective learning assessments. Focus ONLY on core concepts and key insights - avoid trivial details. You MUST respond with ONLY valid JSON in the exact format specified. If you cannot create high-quality questions that meet the requirements, return an empty questions array."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
      });

      let jsonText = response.content[0].text.trim();
      
      // Try to clean up common JSON formatting issues
      jsonText = jsonText.replace(/\n\s*/g, ' '); // Remove newlines and extra spaces
      jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
      jsonText = jsonText.replace(/([{\[,]\s*)([^"{\[].+?)(:)/g, '$1"$2"$3'); // Add quotes to unquoted keys
      
      try {
        const result = JSON.parse(jsonText);
        
        if (!result.questions || !Array.isArray(result.questions)) {
          console.error('Invalid response structure:', jsonText);
          throw new Error("Invalid response format from Anthropic - missing questions array");
        }

        // Validate and clean up each question
        return result.questions.map((q: any) => {
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
        
      } catch (parseError) {
        console.error('Failed to parse Anthropic response as JSON:', jsonText);
        throw new Error("Failed to parse response as valid JSON");
      }
      
    } catch (error) {
      console.error("Error generating questions:", error);
      throw new Error("Failed to generate questions from content");
    }
  }

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
      const response = await this.client.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 50,
        messages: [
          {
            role: "system",
            content: "You are a content categorization expert. Respond with ONLY the single most appropriate category name from the provided list. Use 'general' if uncertain."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
      });

      const category = response.content[0].text?.trim().toLowerCase() || "general";
      const validCategories = ["programming", "science", "history", "business", "mathematics", "languages", "general"];
      
      return validCategories.includes(category) ? category : "general";
    } catch (error) {
      console.error("Error categorizing content:", error);
      return "general";
    }
  }
}
