import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import Navigation from "@/components/navigation";
import VideoInput from "@/components/video-input";
import WatchHistoryImport from "@/components/watch-history-import";
import AutomationSetup from "@/components/automation-setup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  Video, 
  CheckCircle, 
  Brain, 
  Flame,
  Play,
  Plus,
  Clock,
  AlertCircle,
  Star
} from "lucide-react";

export default function Dashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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
      if (isUnauthorizedError(error as Error)) {
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

  const { data: videos = [], isLoading: videosLoading } = useQuery({
    queryKey: ["/api/videos"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Debug videos data
  useEffect(() => {
    if (videos && videos.length > 0) {
      console.log("Videos data received:", videos);
      (videos as any[]).forEach((video: any) => {
        console.log(`Video "${video.title}": quizCompleted=${video.quizCompleted}, hasQuiz=${video.hasQuiz}, questionCount=${video.questionCount}`);
      });
    }
  }, [videos]);

  const { data: dueReviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ["/api/reviews/due"],
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/analytics"],
    enabled: isAuthenticated,
    retry: false,
  });

  const handleStartQuiz = async (videoId: string) => {
    try {
      setLocation(`/quiz?video=${videoId}`);
    } catch (error) {
      if (isUnauthorizedError(error as Error)) {
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
    }
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

  const stats = analytics || {
    totalVideos: 0,
    totalQuizzes: 0,
    averageScore: 0,
    streakDays: 0,
    retentionRate: 0,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Learning Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back, {user?.firstName}!</p>
          </div>
          <div className="flex items-center space-x-4">
            {stats.streakDays > 0 && (
              <Badge className="bg-learning-green text-white px-4 py-2">
                <Flame className="mr-2 h-4 w-4" />
                {stats.streakDays} Day Streak
              </Badge>
            )}
          </div>
        </div>

        {/* Video Input Options */}
        <div className="mb-8">
          <Tabs defaultValue="single" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="single">Single Video</TabsTrigger>
              <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
              <TabsTrigger value="automation">Automation</TabsTrigger>
            </TabsList>
            <TabsContent value="single" className="mt-6">
              <VideoInput />
            </TabsContent>
            <TabsContent value="bulk" className="mt-6">
              <WatchHistoryImport onImportComplete={() => {
                window.location.reload();
              }} />
            </TabsContent>
            <TabsContent value="automation" className="mt-6">
              <AutomationSetup onSetupComplete={() => {
                window.location.reload();
              }} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Videos Analyzed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalVideos}</p>
                </div>
                <div className="w-12 h-12 bg-education-blue bg-opacity-10 rounded-lg flex items-center justify-center">
                  <Video className="text-education-blue" size={20} />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Quizzes Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalQuizzes}</p>
                </div>
                <div className="w-12 h-12 bg-learning-green bg-opacity-10 rounded-lg flex items-center justify-center">
                  <CheckCircle className="text-learning-green" size={20} />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Retention Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{Math.round(stats.retentionRate)}%</p>
                </div>
                <div className="w-12 h-12 bg-review-orange bg-opacity-10 rounded-lg flex items-center justify-center">
                  <Brain className="text-review-orange" size={20} />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Learning Streak</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.streakDays} days</p>
                </div>
                <div className="w-12 h-12 bg-youtube-red bg-opacity-10 rounded-lg flex items-center justify-center">
                  <Flame className="text-youtube-red" size={20} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Videos and Due Reviews */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Videos */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Videos</CardTitle>
            </CardHeader>
            <CardContent>
              {videosLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-education-blue mx-auto mb-4"></div>
                  <p>Loading videos...</p>
                </div>
              ) : videos.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Video size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No videos analyzed yet</p>
                  <p className="text-sm">Add a YouTube video above to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {videos.slice(0, 3).map((video: any) => (
                    <div
                      key={video.id}
                      className="flex items-center space-x-4 p-4 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      {video.thumbnail && (
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-20 h-12 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 line-clamp-1">{video.title}</h4>
                        <p className="text-sm text-gray-600">
                          {video.channelName} • {Math.round(video.duration / 60)} minutes
                        </p>
                        <p className="text-xs mt-1">
                          {video.quizCompleted ? (
                            <span className="text-learning-green">✓ Quiz completed • {video.questionCount} questions</span>
                          ) : (
                            <span className="text-gray-500">Quiz not completed yet</span>
                          )}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={() => handleStartQuiz(video.id)}
                          className="bg-education-blue hover:bg-education-dark-blue"
                        >
                          <Play className="mr-1 h-3 w-3" />
                          Quiz
                        </Button>
                        {(true) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              console.log(`Generating more questions for video: ${(video as any).title}`, {
                                hasQuiz: (video as any).hasQuiz,
                                quizCompleted: (video as any).quizCompleted,
                                questionCount: (video as any).questionCount
                              });
                              if (!(video as any).quizCompleted) {
                                toast({
                                  title: "Complete Quiz First",
                                  description: "You need to complete the quiz before generating more questions.",
                                  variant: "destructive",
                                });
                                return;
                              }
                              generateMoreQuestionsMutation.mutate((video as any).id);
                            }}
                            disabled={generateMoreQuestionsMutation.isPending}
                            className="border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white bg-white"
                            title={(video as any).quizCompleted ? "Generate more questions" : "Complete quiz first to unlock"}
                          >
                            {generateMoreQuestionsMutation.isPending ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-learning-green mr-1"></div>
                            ) : (
                              <Plus className="mr-1 h-3 w-3" />
                            )}
                            {(video as any).quizCompleted ? "More" : "More (Quiz First)"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Due Reviews */}
          <Card>
            <CardHeader>
              <CardTitle>Due for Review</CardTitle>
            </CardHeader>
            <CardContent>
              {reviewsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-review-orange mx-auto mb-4"></div>
                  <p>Loading reviews...</p>
                </div>
              ) : dueReviews.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No reviews due</p>
                  <p className="text-sm">Great job staying on top of your learning!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dueReviews.slice(0, 3).map((review: any) => {
                    const isOverdue = new Date(review.nextReview) < new Date(Date.now() - 24 * 60 * 60 * 1000);
                    const isDueToday = new Date(review.nextReview).toDateString() === new Date().toDateString();
                    
                    return (
                      <div
                        key={review.id}
                        className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                          isOverdue
                            ? "bg-red-50 border-red-200"
                            : isDueToday
                            ? "bg-orange-50 border-orange-200"
                            : "bg-green-50 border-green-200"
                        }`}
                      >
                        <div>
                          <h4 className="font-medium text-gray-900 line-clamp-1">
                            {review.video?.title}
                          </h4>
                          <p className={`text-sm ${
                            isOverdue
                              ? "text-red-600"
                              : isDueToday
                              ? "text-orange-600"
                              : "text-green-600"
                          }`}>
                            {isOverdue
                              ? "Overdue"
                              : isDueToday
                              ? "Due today"
                              : "Due soon"
                            }
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className={
                            isOverdue
                              ? "bg-youtube-red hover:bg-youtube-dark-red"
                              : isDueToday
                              ? "bg-review-orange hover:bg-yellow-600"
                              : "bg-learning-green hover:bg-green-600"
                          }
                        >
                          Review
                        </Button>
                      </div>
                    );
                  })}
                  {dueReviews.length > 3 && (
                    <div className="text-center mt-6">
                      <Button variant="ghost" className="text-education-blue">
                        View All Reviews
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
