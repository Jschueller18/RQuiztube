import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface WatchHistoryImportProps {
  onImportComplete?: () => void;
}

interface ImportProgress {
  current: number;
  total: number;
  currentVideo: string;
}

export default function WatchHistoryImport({ onImportComplete }: WatchHistoryImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (data: { watchHistory?: any[], htmlContent?: string, videoData?: any }) => {
      let endpoint = "/api/import-watch-history";
      if (data.htmlContent) {
        endpoint = "/api/import/html";
      } else if (data.videoData) {
        endpoint = "/api/import/educational-videos";
      }
      const response = await apiRequest("POST", endpoint, data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Import Complete",
        description: "Your YouTube watch history has been imported successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      setImportProgress(null);
      setFile(null);
      onImportComplete?.();
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import watch history",
        variant: "destructive",
      });
      setImportProgress(null);
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const isJson = selectedFile.type === "application/json" || selectedFile.name.endsWith(".json");
      const isHtml = selectedFile.type === "text/html" || selectedFile.name.endsWith(".html");
      
      if (isJson || isHtml) {
        setFile(selectedFile);
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please select a JSON or HTML file",
          variant: "destructive",
        });
      }
    }
  };

  const handleImport = async () => {
    if (!file) return;

    try {
      const fileContent = await file.text();
      const isHtmlFile = file.name.endsWith('.html') || file.type === 'text/html';
      
      if (isHtmlFile) {
        // Handle HTML file (watch-history.html from Google Takeout)
        setImportProgress({ current: 0, total: 1, currentVideo: "Processing HTML file..." });
        importMutation.mutate({ htmlContent: fileContent });
      } else {
        // Handle JSON file - detect format
        const jsonData = JSON.parse(fileContent);
        
        // Check if it's the structured educational video format
        if (jsonData.videos && Array.isArray(jsonData.videos) && jsonData.metadata) {
          // Structured educational video format
          const videos = jsonData.videos;
          const totalVideos = Math.min(videos.length, 50); // Limit for performance
          
          setImportProgress({ 
            current: 0, 
            total: totalVideos, 
            currentVideo: "Processing structured educational video data..." 
          });
          
          importMutation.mutate({ videoData: jsonData });
          
        } else if (Array.isArray(jsonData)) {
          // Legacy Google Takeout format
          const validVideos = jsonData
            .filter(item => 
              item.titleUrl && 
              item.titleUrl.includes('youtube.com/watch') &&
              item.title && 
              item.title !== "Watched a video that has been removed"
            )
            .map(item => ({
              url: item.titleUrl,
              title: item.title,
              time: item.time,
              subtitles: item.subtitles?.[0]?.name || null
            }))
            .slice(0, 50);

          if (validVideos.length === 0) {
            throw new Error("No valid YouTube videos found in the file.");
          }

          setImportProgress({ current: 0, total: validVideos.length, currentVideo: "" });
          importMutation.mutate({ watchHistory: validVideos });
          
        } else {
          throw new Error("Unrecognized JSON format. Please check your file format.");
        }
      }

    } catch (error) {
      toast({
        title: "File Processing Error",
        description: error instanceof Error ? error.message : "Failed to process the file",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import YouTube Watch History
        </CardTitle>
        <CardDescription>
          Upload your YouTube data to automatically generate quizzes from videos. Supports Google Takeout files and structured educational video data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Supported file formats:</strong>
            <div className="mt-2 space-y-3 text-sm">
              <div>
                <strong>Google Takeout:</strong>
                <ol className="list-decimal list-inside mt-1 space-y-1">
                  <li>Go to <a href="https://takeout.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Takeout</a></li>
                  <li>Select "YouTube and YouTube Music"</li>
                  <li>Choose "history" folder and find "watch-history.html"</li>
                  <li>Extract the HTML file from the ZIP and upload it here</li>
                </ol>
              </div>
              <div>
                <strong>Structured Educational Data:</strong>
                <p className="mt-1">Upload JSON files containing structured video data with metadata and video information.</p>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="watch-history-file">YouTube Watch History File</Label>
          <Input
            id="watch-history-file"
            type="file"
            accept=".json,.html"
            onChange={handleFileChange}
            disabled={importMutation.isPending}
          />
          {file && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <FileText className="h-4 w-4" />
              <span>{file.name}</span>
              <CheckCircle className="h-4 w-4" />
            </div>
          )}
        </div>

        {importProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Processing videos...</span>
              <span>{importProgress.current} / {importProgress.total}</span>
            </div>
            <Progress 
              value={(importProgress.current / importProgress.total) * 100} 
              className="w-full" 
            />
            {importProgress.currentVideo && (
              <p className="text-sm text-gray-600 truncate">
                Current: {importProgress.currentVideo}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={handleImport}
            disabled={!file || importMutation.isPending}
            className="flex-1"
          >
            {importMutation.isPending ? "Importing..." : "Import Watch History"}
          </Button>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            We'll process up to 50 of your most recent videos to create personalized quizzes. 
            This process may take a few minutes as we analyze each video.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}