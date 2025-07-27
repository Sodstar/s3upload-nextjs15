// app/page.tsx - Example usage
'use client';

import S3Uploader from "@/components/s3uploader";
import React, {useState} from 'react';

export default function HomePage() {
  const [uploadFiles, setUploadFiles] = useState<any[]>([]);
  const [profileImage, setProfileImage] = useState<string>('images.jpg');
  const handleUploadComplete = (files: any[]) => {
    console.log('Upload completed:', files);
    setUploadFiles(files);
    // Handle successful upload
  };

  const handleUploadProfileComplete = (files: any[]) => {
    console.log('Upload completed:', files[0].url);
    setProfileImage(files[0].url);
    
    // Handle successful upload
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
    // Handle upload error
  };
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">S3 File Uploader Demo</h1>
      

      {/* Profile Image Uploader */}
      <div className="mb-12">
        <div className="flex flex-col items-center">
        <h2 className="text-xl font-semibold mb-4">Profile Image Upload</h2>
        <img src={profileImage} alt="Profile" className="mb-4 w-32 h-32 object-cover rounded-full" />
        <p className="text-sm text-gray-500 mb-4">Upload a profile image (max 5MB)</p>

        </div>
         {/* Single file upload for profile image */}
        <S3Uploader
          multiple={false}
          accept="image/*"
          maxSizeInMB={5}
          onUploadComplete={handleUploadProfileComplete}
          onUploadError={handleUploadError}
        />
      </div>

      {/* Single Image Uploader */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Single Image Upload</h2>
        <S3Uploader
          multiple={false}
          accept="image/*"
          maxSizeInMB={5}
          onUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
        />
      </div>

      {/* Multiple Images Uploader */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Multiple Images Upload</h2>
        <S3Uploader
          multiple={true}
          accept="image/*"
          maxSizeInMB={10}
          onUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
        />
      </div>

      {/* Any File Type Uploader */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Any File Type Upload</h2>
        <S3Uploader
          multiple={true}
          accept="*/*"
          maxSizeInMB={20}
          onUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
        />
      </div>
    </div>
  );
}