import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Clock, CheckCircle, ArrowLeft, ArrowRight, SkipForward } from "lucide-react";

interface Question {
  id: string;
  question: string;
  options: string[];
  difficulty: string;
}

interface QuizInterfaceProps {
  session: {
    id: string;
    totalQuestions: number;
  };
  questions: Question[];
  video: {
    title: string;
    channelName: string;
    thumbnail?: string;
  };
  onComplete: () => void;
}

export default function QuizInterface({ session, questions, video, onComplete }: QuizInterfaceProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    explanation: string;
    correctAnswer: number;
  } | null>(null);
  
  const { toast } = useToast();
  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / session.totalQuestions) * 100;

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleCompleteQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const answerMutation = useMutation({
    mutationFn: async (answerData: {
      sessionId: string;
      questionId: string;
      userAnswer: number;
      responseTime: number;
    }) => {
      const response = await apiRequest("POST", "/api/quiz/answer", answerData);
      return response.json();
    },
    onSuccess: (data) => {
      setFeedback(data);
      setShowFeedback(true);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to submit answer",
        variant: "destructive",
      });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/quiz/complete", {
        sessionId: session.id,
      });
      return response.json();
    },
    onSuccess: () => {
      onComplete();
    },
  });

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return;

    const responseTime = Math.floor((Date.now() - startTime) / 1000);
    answerMutation.mutate({
      sessionId: session.id,
      questionId: currentQuestion.id,
      userAnswer: selectedAnswer,
      responseTime,
    });
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setFeedback(null);
      setStartTime(Date.now());
    } else {
      handleCompleteQuiz();
    }
  };

  const handleSkip = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setFeedback(null);
      setStartTime(Date.now());
    } else {
      handleCompleteQuiz();
    }
  };

  const handleCompleteQuiz = () => {
    completeMutation.mutate();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading questions...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 text-white py-16 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-4">Interactive Quiz Session</h2>
          <div className="flex items-center justify-center space-x-8">
            <div className="flex items-center space-x-2">
              <Clock className="text-review-orange" />
              <span>{formatTime(timeRemaining)} remaining</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="text-learning-green" />
              <span>Question {currentQuestionIndex + 1} of {session.totalQuestions}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <Progress value={progress} className="w-full mb-8" />

        {/* Quiz Card */}
        <Card className="bg-white text-gray-900 shadow-lg">
          <CardHeader>
            <div className="flex items-center space-x-3 mb-4">
              {video.thumbnail && (
                <img 
                  src={video.thumbnail} 
                  alt={video.title}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              )}
              <div>
                <CardTitle className="text-lg">{video.title}</CardTitle>
                <p className="text-sm text-gray-600">From: {video.channelName}</p>
              </div>
              <Badge variant="outline" className="ml-auto">
                {currentQuestion.difficulty}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent>
            {!showFeedback ? (
              <>
                <div className="mb-6">
                  <h4 className="text-xl font-semibold mb-4">{currentQuestion.question}</h4>
                  <div className="space-y-3">
                    {currentQuestion.options.map((option, index) => (
                      <label
                        key={index}
                        className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          selectedAnswer === index
                            ? "border-education-blue bg-blue-50"
                            : "border-gray-200 hover:border-education-blue hover:bg-blue-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="question"
                          className="w-5 h-5 text-education-blue"
                          checked={selectedAnswer === index}
                          onChange={() => setSelectedAnswer(index)}
                        />
                        <span className="ml-3 text-lg">{option}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <Button
                    variant="ghost"
                    onClick={() => currentQuestionIndex > 0 && setCurrentQuestionIndex(prev => prev - 1)}
                    disabled={currentQuestionIndex === 0}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex space-x-4">
                    <Button
                      variant="outline"
                      onClick={handleSkip}
                    >
                      <SkipForward className="mr-2 h-4 w-4" />
                      Skip
                    </Button>
                    <Button
                      onClick={handleSubmitAnswer}
                      disabled={selectedAnswer === null || answerMutation.isPending}
                      className="bg-education-blue hover:bg-education-dark-blue"
                    >
                      Submit Answer
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              /* Feedback Panel */
              <div className={`rounded-xl p-6 ${
                feedback?.correct ? "bg-learning-green text-white" : "bg-red-500 text-white"
              }`}>
                <div className="flex items-center space-x-3 mb-4">
                  <CheckCircle className="text-2xl" />
                  <h4 className="text-xl font-semibold">
                    {feedback?.correct ? "Correct!" : "Incorrect"}
                  </h4>
                </div>
                <p className="mb-4">{feedback?.explanation}</p>
                {!feedback?.correct && (
                  <p className="mb-4">
                    Correct answer: {currentQuestion.options[feedback?.correctAnswer || 0]}
                  </p>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm opacity-90">
                    Question {currentQuestionIndex + 1} of {session.totalQuestions} completed
                  </span>
                  <Button
                    onClick={handleNextQuestion}
                    className="bg-white text-gray-900 hover:bg-gray-100"
                  >
                    {currentQuestionIndex < questions.length - 1 ? (
                      <>
                        Next Question
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    ) : (
                      "Complete Quiz"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
