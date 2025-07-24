import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import Navigation from "@/components/navigation";
import QuizInterface from "@/components/quiz-interface";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Trophy, Star, Home, BarChart3 } from "lucide-react";

export default function Quiz() {
  const [, params] = useRoute("/quiz/:sessionId?");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [quizData, setQuizData] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<any>(null);

  // Get video ID from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get('video');

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const startQuizMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const response = await apiRequest("POST", "/api/quiz/start", { videoId });
      return response.json();
    },
    onSuccess: (data) => {
      setQuizData(data);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to start quiz",
        variant: "destructive",
      });
    },
  });

  const generateMoreQuestionsMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const response = await apiRequest("POST", `/api/videos/${videoId}/generate-questions`, { count: 5 });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: `Generated ${data.questions} new questions for ${data.video}`,
      });
      // Invalidate cache to refresh video data
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to generate more questions",
        variant: "destructive",
      });
    },
  });

  // Start quiz if we have a video ID but no quiz data
  useEffect(() => {
    if (videoId && !quizData && !params?.sessionId) {
      startQuizMutation.mutate(videoId);
    }
  }, [videoId, quizData, params?.sessionId]);

  const handleQuizComplete = (actualResults: {
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    timeSpent: number;
  }) => {
    setShowResults(true);
    setResults(actualResults);
    // Invalidate videos cache so dashboard updates completion status
    queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-youtube-red mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (startQuizMutation.isPending) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-education-blue mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Preparing Your Quiz</h2>
            <p className="text-gray-600">Analyzing video content and generating questions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (showResults && results) {
    const percentage = Math.round((results.correctAnswers / results.totalQuestions) * 100);
    const grade = percentage >= 90 ? "A" : percentage >= 80 ? "B" : percentage >= 70 ? "C" : percentage >= 60 ? "D" : "F";
    const gradeColor = percentage >= 80 ? "text-learning-green" : percentage >= 60 ? "text-review-orange" : "text-red-500";

    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Card className="text-center">
            <CardHeader>
              <div className="w-16 h-16 bg-learning-green bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="h-8 w-8 text-learning-green" />
              </div>
              <CardTitle className="text-3xl">Quiz Complete!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className={`text-4xl font-bold ${gradeColor} mb-2`}>{percentage}%</div>
                  <p className="text-gray-600">Your Score</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-education-blue mb-2">
                    {results.correctAnswers}/{results.totalQuestions}
                  </div>
                  <p className="text-gray-600">Questions Correct</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-review-orange mb-2">
                    {Math.floor(results.timeSpent / 60)}m {results.timeSpent % 60}s
                  </div>
                  <p className="text-gray-600">Time Spent</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center justify-center space-x-2 mb-4">
                  <Star className="h-5 w-5 text-yellow-500" />
                  <span className="font-semibold">Learning Progress</span>
                </div>
                <p className="text-gray-600">
                  Great job! Your performance shows good understanding of the material. 
                  Keep practicing with spaced repetition to improve long-term retention.
                </p>
              </div>

              <div className="flex justify-center space-x-4">
                <Button
                  onClick={() => setLocation("/")}
                  className="bg-education-blue hover:bg-education-dark-blue"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLocation("/analytics")}
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View Analytics
                </Button>
                {quizData?.video && (
                  <Button
                    variant="outline"
                    onClick={() => generateMoreQuestionsMutation.mutate(quizData.video.id)}
                    disabled={generateMoreQuestionsMutation.isPending}
                    className="border-learning-green text-learning-green hover:bg-learning-green hover:text-white"
                  >
                    {generateMoreQuestionsMutation.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-learning-green mr-2"></div>
                    ) : (
                      <Star className="mr-2 h-4 w-4" />
                    )}
                    Generate More Questions
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!quizData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Card>
            <CardContent className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">No Quiz Available</h2>
              <p className="text-gray-600 mb-6">
                No quiz session found. Please start a quiz from your dashboard.
              </p>
              <Button onClick={() => setLocation("/")}>
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navigation />
      <QuizInterface
        session={quizData.session}
        questions={quizData.questions}
        video={quizData.video}
        onComplete={handleQuizComplete}
      />
    </div>
  );
}
