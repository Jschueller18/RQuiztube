export class SpacedRepetitionService {
  /**
   * Calculate the next review date based on SM-2 algorithm
   * @param easeFactor Current ease factor (starts at 2.5)
   * @param repetitions Number of successful repetitions
   * @param quality Quality of response (0-5, where 3+ is passing)
   * @returns Object with new ease factor, repetitions, and interval in days
   */
  calculateNextReview(
    easeFactor: number = 2.5,
    repetitions: number = 0,
    quality: number
  ): {
    easeFactor: number;
    repetitions: number;
    interval: number;
    nextReview: Date;
  } {
    let newEaseFactor = easeFactor;
    let newRepetitions = repetitions;
    let interval: number;

    // If quality is less than 3, reset repetitions
    if (quality < 3) {
      newRepetitions = 0;
      interval = 1;
    } else {
      // Update ease factor
      newEaseFactor = Math.max(
        1.3,
        easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
      );

      // Calculate interval based on repetitions
      if (newRepetitions === 0) {
        interval = 1;
      } else if (newRepetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * newEaseFactor);
      }

      newRepetitions++;
    }

    // Calculate next review date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    return {
      easeFactor: newEaseFactor,
      repetitions: newRepetitions,
      interval,
      nextReview,
    };
  }

  /**
   * Convert quiz performance to SM-2 quality score
   * @param isCorrect Whether the answer was correct
   * @param responseTime Time taken to answer in seconds
   * @returns Quality score (0-5)
   */
  calculateQuality(isCorrect: boolean, responseTime: number = 30): number {
    if (!isCorrect) {
      return Math.random() < 0.5 ? 0 : 1; // Random between 0-1 for incorrect
    }

    // For correct answers, factor in response time
    // Faster responses get higher quality scores
    if (responseTime <= 10) return 5; // Very fast
    if (responseTime <= 20) return 4; // Fast
    if (responseTime <= 45) return 3; // Normal
    return 3; // Slow but correct
  }

  /**
   * Get optimal review intervals based on user performance
   */
  getReviewIntervals(): number[] {
    return [1, 3, 7, 14, 30, 90]; // days
  }

  /**
   * Determine if a question should be reviewed based on scheduling
   */
  shouldReview(lastReview: Date, interval: number): boolean {
    const now = new Date();
    const nextReviewDate = new Date(lastReview);
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);
    
    return now >= nextReviewDate;
  }

  /**
   * Calculate retention probability based on time elapsed
   */
  calculateRetentionProbability(
    daysSinceLastReview: number,
    easeFactor: number = 2.5
  ): number {
    // Simplified retention curve
    const decay = Math.exp(-daysSinceLastReview / (easeFactor * 10));
    return Math.max(0.1, decay);
  }
}
