"use client";

import { useState, useRef } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { PhotoIcon, XMarkIcon } from "@heroicons/react/24/outline";

interface Props {
  value: string[]; // Array of image URLs
  onChange: (urls: string[]) => void;
  folder?: string; // Firebase Storage folder path
  multiple?: boolean;
}

const MAX_FILE_SIZE = 500 * 1024; // 500KB in bytes
const MAX_WIDTH = 1920; // Max width for resizing
const MAX_HEIGHT = 1920; // Max height for resizing
const QUALITY = 0.85; // JPEG quality (0.85 = 85%)

// Compress image to target size
function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width > height) {
            height = (height * MAX_WIDTH) / width;
            width = MAX_WIDTH;
          } else {
            width = (width * MAX_HEIGHT) / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to compress image"));
              return;
            }

            // If still too large, reduce quality further
            if (blob.size > MAX_FILE_SIZE) {
              let currentQuality = QUALITY - 0.1; // Start with lower quality
              const reduceQuality = (): void => {
                canvas.toBlob(
                  (reducedBlob) => {
                    if (!reducedBlob) {
                      reject(new Error("Failed to compress image"));
                      return;
                    }

                    if (reducedBlob.size > MAX_FILE_SIZE && currentQuality > 0.1) {
                      currentQuality -= 0.1;
                      reduceQuality();
                    } else {
                      const compressedFile = new File(
                        [reducedBlob],
                        file.name.replace(/\.[^/.]+$/, ".jpg"), // Replace extension with .jpg
                        { type: "image/jpeg" }
                      );
                      resolve(compressedFile);
                    }
                  },
                  "image/jpeg",
                  Math.max(currentQuality, 0.1) // Ensure quality doesn't go below 0.1
                );
              };
              reduceQuality();
            } else {
              const compressedFile = new File(
                [blob],
                file.name.replace(/\.[^/.]+$/, ".jpg"), // Replace extension with .jpg
                { type: "image/jpeg" }
              );
              resolve(compressedFile);
            }
          },
          "image/jpeg",
          QUALITY
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

export function ImageUpload({ value = [], onChange, folder = "guitars", multiple = true }: Props) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check authentication
    if (!user) {
      setError("You must be logged in to upload images");
      return;
    }

    if (user.role !== "ADMIN") {
      setError("Only admins can upload images");
      return;
    }

    setUploading(true);
    setCompressing(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Compress all images first
      const compressedFiles: File[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress((i / files.length) * 50); // 0-50% for compression
        try {
          const compressed = await compressImage(file);
          compressedFiles.push(compressed);
          console.log(
            `Compressed ${file.name}: ${(file.size / 1024).toFixed(2)}KB → ${(compressed.size / 1024).toFixed(2)}KB`
          );
        } catch (error) {
          console.error(`Error compressing ${file.name}:`, error);
          // Fallback to original file if compression fails
          compressedFiles.push(file);
        }
      }

      setCompressing(false);
      setUploadProgress(50);

      // Upload compressed images one at a time to avoid overwhelming
      const urls: string[] = [];
      for (let index = 0; index < compressedFiles.length; index++) {
        const file = compressedFiles[index];
        try {
          // Generate unique filename
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(2, 8);
          const fileName = `${timestamp}_${randomStr}_${index}.jpg`; // Always use .jpg after compression
          const storagePath = `${folder}/${fileName}`;

          // Update progress
          setUploadProgress(50 + (index / compressedFiles.length) * 50);

          // Upload to Firebase Storage
          const storageRef = ref(storage, storagePath);
          await uploadBytes(storageRef, file);

          // Get download URL
          const downloadURL = await getDownloadURL(storageRef);
          urls.push(downloadURL);
        } catch (uploadError: any) {
          console.error(`Error uploading ${file.name}:`, uploadError);
          // Check for specific error types
          if (uploadError?.code === "storage/unauthorized") {
            setError("Permission denied. Make sure you're logged in as an admin and storage rules are deployed.");
          } else if (uploadError?.code === "storage/canceled") {
            setError("Upload was canceled");
          } else {
            setError(`Failed to upload ${file.name}. ${uploadError?.message || "Unknown error"}`);
          }
          throw uploadError; // Stop uploading remaining files
        }
      }

      onChange([...value, ...urls]);
      setUploadProgress(100);
    } catch (error: any) {
      console.error("Error uploading images:", error);
      if (!error?.message?.includes("Permission denied")) {
        setError(error?.message || "Failed to upload images. Please check your connection and try again.");
      }
    } finally {
      setUploading(false);
      setCompressing(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleClick() {
    fileInputRef.current?.click();
  }

  return (
    <div className="space-y-3">
      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
          <p className="text-xs text-red-400">{error}</p>
          {error.includes("storage rules") && (
            <p className="mt-1 text-xs text-red-300">
              Run: <code className="bg-black/30 px-1 rounded">firebase deploy --only storage:rules</code>
            </p>
          )}
        </div>
      )}

      {/* Upload Button */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={handleClick}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/20 bg-white/5 px-4 py-6 text-sm font-medium text-neutral-400 transition hover:border-accent/50 hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
              <span>{compressing ? "Compressing..." : "Uploading..."}</span>
            </>
          ) : (
            <>
              <PhotoIcon className="h-5 w-5" />
              <span>Click to upload images (auto-compressed to ~500KB)</span>
            </>
          )}
        </button>
        {uploading && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* Image Preview Grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {value.map((url, index) => (
            <div key={index} className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Upload ${index + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="absolute right-2 top-2 rounded-full bg-red-500/80 p-1.5 text-white opacity-0 transition hover:bg-red-500 group-hover:opacity-100"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Manual URL Input (Fallback) */}
      <div>
        <label className="mb-2 block text-xs font-medium text-neutral-400">
          Or enter image URLs (one per line)
        </label>
        <textarea
          value={value.join("\n")}
          onChange={(e) => {
            const urls = e.target.value.split("\n").filter((url) => url.trim());
            onChange(urls);
          }}
          rows={3}
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-neutral-600 outline-none transition focus:border-accent/50"
          placeholder="https://example.com/image.jpg"
        />
      </div>
    </div>
  );
}

