import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Youtube } from "lucide-react";

interface VideoInputProps {
  onVideoAnalyzed?: (video: any) => void;
}

export default function VideoInput({ onVideoAnalyzed }: VideoInputProps) {
  const [url, setUrl] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const analyzeMutation = useMutation({
    mutationFn: async (videoUrl: string) => {
      const response = await apiRequest("POST", "/api/videos/analyze", { url: videoUrl });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Video Analyzed!",
        description: `Generated ${data.questions.length} questions for "${data.video.title}"`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      onVideoAnalyzed?.(data);
      setUrl("");
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    analyzeMutation.mutate(url.trim());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Youtube className="h-5 w-5 text-youtube-red" />
          <span>Add YouTube Video</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <Input
            type="url"
            placeholder="Paste YouTube URL here..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={analyzeMutation.isPending}
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={analyzeMutation.isPending || !url.trim()}
            className="bg-education-blue hover:bg-education-dark-blue"
          >
            {analyzeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Analyze
          </Button>
        </form>
        <p className="text-sm text-gray-600 mt-2">
          Our AI will analyze the video content and generate personalized quiz questions for optimal learning.
        </p>
      </CardContent>
    </Card>
  );
}
