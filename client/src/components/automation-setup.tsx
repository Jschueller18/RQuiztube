import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Cloud, 
  ExternalLink, 
  CheckCircle, 
  Settings, 
  Zap,
  FolderOpen,
  Download,
  AlertCircle
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AutomationSetupProps {
  onSetupComplete?: () => void;
}

export default function AutomationSetup({ onSetupComplete }: AutomationSetupProps) {
  const [automationMethod, setAutomationMethod] = useState<string | null>(null);
  const { toast } = useToast();

  const createDriveFolderMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/automation/create-drive-folder", "POST", {});
    },
    onSuccess: (data) => {
      toast({
        title: "Automation Setup Complete",
        description: "Your Google Drive folder has been created and shared with you.",
      });
      setAutomationMethod("google-drive");
      onSetupComplete?.();
    },
    onError: (error) => {
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to set up Google Drive automation",
        variant: "destructive",
      });
    },
  });

  const { data: driveFiles } = useQuery({
    queryKey: ["/api/automation/drive-files"],
    enabled: automationMethod === "google-drive",
    refetchInterval: 30000, // Refresh every 30 seconds to check for new files
  });

  const processDriveFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return await apiRequest("/api/automation/process-drive-file", "POST", { fileId });
    },
    onSuccess: (data) => {
      toast({
        title: "Processing Complete",
        description: `Successfully processed ${data.processedCount} videos automatically.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process the file",
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Automation Setup
        </CardTitle>
        <CardDescription>
          Set up automated processing of your YouTube watch history using cloud storage integration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {!automationMethod && (
          <div className="space-y-4">
            <h3 className="font-semibold">Choose Your Automation Method</h3>
            
            <div className="grid gap-4">
              {/* Google Drive Option */}
              <Card className="cursor-pointer hover:bg-gray-50 transition-colors border-2">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Cloud className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">Google Drive Integration</h4>
                        <p className="text-sm text-gray-600">
                          Automatic processing when you upload files to a shared folder
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => createDriveFolderMutation.mutate()}
                      disabled={createDriveFolderMutation.isPending}
                    >
                      {createDriveFolderMutation.isPending ? "Setting up..." : "Set Up"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Zapier Option */}
              <Card className="cursor-pointer hover:bg-gray-50 transition-colors border-2">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <Zap className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">Zapier Integration</h4>
                        <p className="text-sm text-gray-600">
                          Advanced automation with custom triggers and workflows
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">Coming Soon</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {automationMethod === "google-drive" && createDriveFolderMutation.data && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Setup Complete!</strong> Your Google Drive automation is now active.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <h4 className="font-medium">Next Steps:</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                {createDriveFolderMutation.data.instructions.map((instruction: string, index: number) => (
                  <li key={index}>{instruction}</li>
                ))}
              </ol>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => window.open(createDriveFolderMutation.data.shareUrl, '_blank')}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Drive Folder
              </Button>
            </div>

            {/* File Monitoring */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Monitoring for New Files
              </h4>
              
              {driveFiles?.files && driveFiles.files.length > 0 ? (
                <div className="space-y-2">
                  {driveFiles.files.map((file: any) => (
                    <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Download className="h-4 w-4 text-gray-500" />
                        <div>
                          <p className="font-medium text-sm">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            Created: {new Date(file.createdTime).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => processDriveFileMutation.mutate(file.id)}
                        disabled={processDriveFileMutation.isPending}
                      >
                        {processDriveFileMutation.isPending ? "Processing..." : "Process"}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No files detected yet. Upload your Google Takeout file to the shared folder to get started.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}

        <Alert>
          <Settings className="h-4 w-4" />
          <AlertDescription>
            <strong>Manual Option:</strong> If you prefer not to use automation, you can still 
            manually upload your watch history JSON file using the import feature above.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}