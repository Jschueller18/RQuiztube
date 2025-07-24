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
  onComplete: (results: {
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    timeSpent: number;
  }) => void;
}

export default function QuizInterface({ session, questions, video, onComplete }: QuizInterfaceProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [quizStartTime] = useState<number>(Date.now());
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    explanation: string;
    correctAnswer: number;
  } | null>(null);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  
  const { toast } = useToast();
  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / session.totalQuestions) * 100;

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
      if (data.correct) {
        setCorrectAnswers(prev => prev + 1);
      }
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
      const timeSpent = Math.floor((Date.now() - quizStartTime) / 1000);
      const score = session.totalQuestions > 0 ? (correctAnswers / session.totalQuestions) * 100 : 0;
      
      onComplete({
        score: Math.round(score),
        totalQuestions: session.totalQuestions,
        correctAnswers,
        timeSpent,
      });
    },
  });

  const handleCompleteQuiz = () => {
    completeMutation.mutate();
  };

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
    <div className="min-h-screen bg-gradient-to-br from-education-blue via-purple-600 to-learning-green p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 text-white">
          <div className="flex items-center space-x-4">
            <div className="text-sm opacity-90">
              Question {currentQuestionIndex + 1} of {session.totalQuestions}
            </div>
            <Progress value={progress} className="w-48 bg-white/20" />
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <Clock size={16} />
            <span>{formatTime(timeRemaining)}</span>
          </div>
        </div>

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
                        onClick={() => setSelectedAnswer(index)}
                      >
                        <input
                          type="radio"
                          name="answer"
                          checked={selectedAnswer === index}
                          onChange={() => setSelectedAnswer(index)}
                          className="sr-only"
                        />
                        <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                          selectedAnswer === index ? "border-education-blue bg-education-blue" : "border-gray-300"
                        }`}>
                          {selectedAnswer === index && (
                            <div className="w-2 h-2 bg-white rounded-full m-0.5" />
                          )}
                        </div>
                        <span className="text-gray-900">{option}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={handleSkip}
                    className="flex items-center"
                  >
                    <SkipForward className="mr-2 h-4 w-4" />
                    Skip
                  </Button>
                  
                  <Button
                    onClick={handleSubmitAnswer}
                    disabled={selectedAnswer === null || answerMutation.isPending}
                    className="bg-education-blue hover:bg-education-dark-blue flex items-center"
                  >
                    {answerMutation.isPending ? "Submitting..." : "Submit Answer"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className={`p-4 rounded-lg ${feedback?.correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center mb-2">
                    <CheckCircle className={`mr-2 h-5 w-5 ${feedback?.correct ? 'text-green-600' : 'text-red-600'}`} />
                    <span className={`font-semibold ${feedback?.correct ? 'text-green-800' : 'text-red-800'}`}>
                      {feedback?.correct ? 'Correct!' : 'Incorrect'}
                    </span>
                  </div>
                  {!feedback?.correct && (
                    <p className="text-sm text-gray-600 mb-2">
                      The correct answer was: <strong>{currentQuestion.options[feedback?.correctAnswer || 0]}</strong>
                    </p>
                  )}
                  <p className="text-sm text-gray-700">{feedback?.explanation}</p>
                </div>

                <div className="flex justify-center">
                  <Button
                    onClick={handleNextQuestion}
                    className="bg-education-blue hover:bg-education-dark-blue flex items-center"
                  >
                    {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Complete Quiz'}
                    <ArrowRight className="ml-2 h-4 w-4" />
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