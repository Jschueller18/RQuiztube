import { google } from 'googleapis';

export class GoogleDriveService {
  private drive: any;

  constructor() {
    // Initialize Google Drive API client
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    this.drive = google.drive({ version: 'v3', auth });
  }

  /**
   * Monitor a specific Google Drive folder for new YouTube Takeout files
   */
  async watchFolder(folderId: string, webhookUrl: string) {
    try {
      const response = await this.drive.files.watch({
        fileId: folderId,
        requestBody: {
          id: `youtube-takeout-${Date.now()}`,
          type: 'web_hook',
          address: webhookUrl,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error setting up Drive folder watch:', error);
      throw error;
    }
  }

  /**
   * Download and extract YouTube watch history from a Google Drive file
   */
  async downloadWatchHistory(fileId: string): Promise<any[]> {
    try {
      // Get file metadata
      const fileMetadata = await this.drive.files.get({
        fileId: fileId,
        fields: 'name, mimeType',
      });

      if (!fileMetadata.data.name.includes('takeout') && 
          !fileMetadata.data.name.includes('youtube')) {
        throw new Error('File does not appear to be a YouTube takeout file');
      }

      // Download file content
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media',
      });

      // If it's a ZIP file, we'd need to extract it
      if (fileMetadata.data.mimeType === 'application/zip') {
        // For ZIP files, we'd need additional processing
        // This is a simplified version - in production you'd extract the ZIP
        throw new Error('ZIP file processing not implemented. Please extract the watch-history.json file first.');
      }

      // Parse JSON content
      const watchHistoryData = JSON.parse(response.data);
      
      // Filter and validate the data
      const validEntries = watchHistoryData.filter((item: any) => 
        item.titleUrl && 
        item.titleUrl.includes('youtube.com/watch') &&
        item.title && 
        item.title !== "Watched a video that has been removed"
      );

      return validEntries;
    } catch (error) {
      console.error('Error downloading watch history:', error);
      throw error;
    }
  }

  /**
   * List files in a specific folder that might be YouTube takeout files
   */
  async listTakeoutFiles(folderId?: string): Promise<any[]> {
    try {
      const query = folderId 
        ? `'${folderId}' in parents and (name contains 'takeout' or name contains 'youtube' or name contains 'watch-history')`
        : `name contains 'takeout' or name contains 'youtube' or name contains 'watch-history'`;

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, createdTime, mimeType)',
        orderBy: 'createdTime desc',
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Error listing takeout files:', error);
      throw error;
    }
  }

  /**
   * Create a shared folder for users to drop their takeout files
   */
  async createTakeoutFolder(userEmail: string): Promise<{ folderId: string; shareUrl: string }> {
    try {
      // Create folder
      const folderResponse = await this.drive.files.create({
        requestBody: {
          name: `YouTube Takeout - ${userEmail}`,
          mimeType: 'application/vnd.google-apps.folder',
        },
      });

      const folderId = folderResponse.data.id;

      // Share folder with user
      await this.drive.permissions.create({
        fileId: folderId,
        requestBody: {
          role: 'writer',
          type: 'user',
          emailAddress: userEmail,
        },
      });

      // Get shareable link
      const shareResponse = await this.drive.files.get({
        fileId: folderId,
        fields: 'webViewLink',
      });

      return {
        folderId: folderId!,
        shareUrl: shareResponse.data.webViewLink!,
      };
    } catch (error) {
      console.error('Error creating takeout folder:', error);
      throw error;
    }
  }
}