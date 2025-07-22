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
You are an expert educational content creator. Based on the following YouTube video content, generate ${count} high-quality multiple-choice questions that test understanding and retention of key concepts.

Video Title: ${title}
Category: ${category}
Transcript/Content: ${transcript.substring(0, 4000)}${existingQuestionsText}

Requirements:
- Create questions that test comprehension, not just memorization
- Include 4 multiple choice options (A, B, C, D) for each question
- Provide clear explanations for correct answers
- Mix difficulty levels (easy, medium, hard)
- Focus on the most important concepts from the content
- Make questions specific to the video content, not general knowledge
${existingQuestions.length > 0 ? '- Avoid creating questions similar to the existing ones listed above' : ''}
- Focus on different aspects, angles, or deeper concepts if similar questions already exist

Respond with a JSON object containing an array called "questions" with this structure:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Detailed explanation of why this answer is correct and others are wrong",
      "difficulty": "easy|medium|hard"
    }
  ]
}
`;

    try {
      const response = await this.client.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 3000,
        messages: [
          {
            role: "system",
            content: "You are an expert educational content creator specializing in creating effective learning assessments."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
      });

      const result = JSON.parse(response.content[0].text || "{}");
      
      if (!result.questions || !Array.isArray(result.questions)) {
        throw new Error("Invalid response format from Anthropic");
      }

      // Validate and clean up the questions
      return result.questions.map((q: any) => ({
        question: q.question || "",
        options: Array.isArray(q.options) ? q.options.slice(0, 4) : [],
        correctAnswer: Math.max(0, Math.min(3, parseInt(q.correctAnswer) || 0)),
        explanation: q.explanation || "",
        difficulty: ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium",
      })).filter((q: any) => q.question && q.options.length === 4);
      
    } catch (error) {
      console.error("Error generating questions:", error);
      throw new Error("Failed to generate questions from content");
    }
  }

  async categorizeContent(title: string, description: string): Promise<string> {
    const prompt = `
Categorize this YouTube video content into one of these categories:
- programming
- science  
- history
- business
- mathematics
- languages
- general

Title: ${title}
Description: ${description.substring(0, 500)}

Respond with just the category name.
`;

    try {
      const response = await this.client.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 50,
        messages: [{ role: "user", content: prompt }],
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
