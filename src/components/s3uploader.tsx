import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, File, Image, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UploadedFile {
  fileName: string;
  key: string;
  url: string;
  size: number;
  type: string;
}

interface FileUploadResult {
  success: boolean;
  files: UploadedFile[];
  error?: string;
  details?: string;
}

interface S3UploaderProps {
  multiple?: boolean;
  accept?: string;
  maxSizeInMB?: number;
  maxFiles?: number;
  onUploadComplete?: (files: UploadedFile[]) => void;
  onUploadError?: (error: string) => void;
  className?: string;
  disabled?: boolean;
}

const DEFAULT_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
];

const S3Uploader: React.FC<S3UploaderProps> = ({
  multiple = false,
  accept = "image/*",
  maxSizeInMB = 20,
  maxFiles = 10,
  onUploadComplete,
  onUploadError,
  className = "",
  disabled = false
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortController = useRef<AbortController | null>(null);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    
    if (file.size > maxSizeInBytes) {
      return `File "${file.name}" exceeds maximum size of ${maxSizeInMB}MB`;
    }

    if (file.size === 0) {
      return `File "${file.name}" is empty`;
    }

    // Basic file type validation (note: this can be spoofed, server should validate too)
    if (accept !== "*/*" && !file.type) {
      return `File "${file.name}" has no type information`;
    }

    return null;
  }, [maxSizeInMB, accept]);

  const validateFiles = useCallback((newFiles: File[]): string | null => {
    const totalFiles = multiple ? files.length + newFiles.length : newFiles.length;
    
    if (totalFiles > maxFiles) {
      return `Cannot upload more than ${maxFiles} files`;
    }

    for (const file of newFiles) {
      const validationError = validateFile(file);
      if (validationError) {
        return validationError;
      }
    }

   
    // Check for duplicate files
    const existingNames = files.map(f => f.name);
    const duplicates = newFiles.filter(f => existingNames.includes(f.name));
    if (duplicates.length > 0) {
      return `Duplicate files detected: ${duplicates.map(f => f.name).join(', ')}`;
    }

    return null;
  }, [files, maxFiles, multiple, validateFile]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    setError(null);

    const validationError = validateFiles(selectedFiles);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (multiple) {
      setFiles(prev => [...prev, ...selectedFiles]);
    } else {
      setFiles(selectedFiles);
    }

    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [multiple, validateFiles]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (disabled) return;

    const droppedFiles = Array.from(event.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    setError(null);

    const validationError = validateFiles(droppedFiles);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (multiple) {
      setFiles(prev => [...prev, ...droppedFiles]);
    } else {
      setFiles(droppedFiles);
    }
  }, [disabled, multiple, validateFiles]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setError(null);
  }, []);

  const cancelUpload = useCallback(() => {
    if (uploadAbortController.current) {
      uploadAbortController.current.abort();
      uploadAbortController.current = null;
    }
    setUploading(false);
    setUploadProgress(0);
  }, []);

  const uploadFiles = useCallback(async () => {
    if (files.length === 0 || uploading) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    
    // Create abort controller for this upload
    uploadAbortController.current = new AbortController();

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 15;
        });
      }, 300);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        signal: uploadAbortController.current.signal,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result: FileUploadResult = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Upload failed with status ${response.status}`);
      }

      if (result.success) {
        setUploadedFiles(result.files);
        setFiles([]);
        onUploadComplete?.(result.files);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Upload cancelled');
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        setError(errorMessage);
        onUploadError?.(errorMessage);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      uploadAbortController.current = null;
    }
  }, [files, uploading, onUploadComplete, onUploadError]);

  const reset = useCallback(() => {
    if (uploading) {
      cancelUpload();
    }
    setFiles([]);
    setUploadedFiles([]);
    setError(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [uploading, cancelUpload]);

  const isImage = useCallback((type: string) => type.startsWith('image/'), []);

  const openFileDialog = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  return (
    <div className={`w-full max-w-2xl mx-auto space-y-4 ${className}`}>
      {/* Upload Area */}
      <Card>
        <CardContent className="p-6">
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
              ${disabled 
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openFileDialog}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={`Upload ${multiple ? 'files' : 'file'}`}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                e.preventDefault();
                openFileDialog();
              }
            }}
          >
            <Upload className={`mx-auto h-12 w-12 mb-4 ${disabled ? 'text-gray-300' : 'text-gray-400'}`} />
            <p className={`text-lg font-medium mb-2 ${disabled ? 'text-gray-400' : 'text-gray-900'}`}>
              {multiple ? 'Upload files' : 'Upload a file'}
            </p>
            <p className={`text-sm mb-4 ${disabled ? 'text-gray-400' : 'text-gray-500'}`}>
              Drag and drop {multiple ? 'files' : 'a file'} here, or click to select
            </p>
            <p className={`text-xs mb-4 ${disabled ? 'text-gray-400' : 'text-gray-500'}`}>
              Max {maxSizeInMB}MB per file, up to {maxFiles} files
            </p>
            <Button type="button" variant="outline" disabled={disabled}>
              Choose {multiple ? 'Files' : 'File'}
            </Button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple={multiple}
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
            aria-hidden="true"
          />
        </CardContent>
      </Card>

      {/* Selected Files */}
      {files.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">
                Selected Files ({files.length})
              </h3>
              <Button 
                onClick={reset} 
                variant="ghost" 
                size="sm"
                disabled={uploading}
              >
                Clear All
              </Button>
            </div>
            
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    {isImage(file.type) ? (
                      <Image className="h-8 w-8 text-blue-500 shrink-0" />
                    ) : (
                      <File className="h-8 w-8 text-gray-500 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => removeFile(index)}
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 shrink-0"
                    disabled={uploading}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {uploading && (
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
                <div className="flex justify-center">
                  <Button 
                    onClick={cancelUpload}
                    variant="outline" 
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    Cancel Upload
                  </Button>
                </div>
              </div>
            )}

            <Button 
              onClick={uploadFiles} 
              disabled={uploading || files.length === 0 || disabled}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {files.length} {files.length === 1 ? 'File' : 'Files'}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Successfully Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-4">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <h3 className="text-lg font-medium text-green-700">
                Upload Complete ({uploadedFiles.length} files)
              </h3>
            </div>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {uploadedFiles.map((file, index) => (
                <div key={`${file.key}-${index}`} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    {isImage(file.type) ? (
                      <Image className="h-8 w-8 text-green-500 shrink-0" />
                    ) : (
                      <File className="h-8 w-8 text-green-500 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" title={file.fileName}>
                        {file.fileName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => window.open(file.url, '_blank', 'noopener,noreferrer')}
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default S3Uploader;