import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Mic, Video, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export type MediaType = 'image' | 'audio' | 'video';
export interface UploadedMedia { type: MediaType; url: string; path: string; file: File; }
interface MultiMediaUploaderProps { onMediaChange: (media: UploadedMedia | null) => void; initialMedia?: UploadedMedia | null; }
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const BUCKET_NAME = 'issue-media';

const MultiMediaUploader = ({ onMediaChange, initialMedia }: MultiMediaUploaderProps) => {
  const [media, setMedia] = useState<UploadedMedia | null>(initialMedia || null);
  const [activeTab, setActiveTab] = useState<MediaType>('image');
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => { setMedia(initialMedia ?? null); }, [initialMedia]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: MediaType) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File is too large", description: "Please choose a file smaller than 50 MB.", variant: "destructive" });
      input.value = ''; return;
    }
    const valid = (type === 'image' && file.type.startsWith('image/')) ||
      (type === 'audio' && file.type.startsWith('audio/')) || (type === 'video' && file.type.startsWith('video/'));
    if (!valid) {
      toast({ title: "Unsupported file", description: `Choose a valid ${type} file.`, variant: "destructive" });
      input.value = ''; return;
    }
    setIsUploading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('Sign in before uploading evidence.');
      const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100);
      const path = `${authData.user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(path, file, {
        cacheControl: '3600', contentType: file.type, upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
      const next: UploadedMedia = { type, url: data.publicUrl, path, file };
      setMedia(next); onMediaChange(next);
      toast({ title: "Upload complete", description: `${type.charAt(0).toUpperCase() + type.slice(1)} evidence uploaded successfully.` });
    } catch (error) {
      console.error('Evidence upload failed:', error);
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Could not upload this file.", variant: "destructive" });
    } finally { setIsUploading(false); input.value = ''; }
  };

  const clearMedia = async () => {
    if (media?.path) {
      const { error } = await supabase.storage.from(BUCKET_NAME).remove([media.path]);
      if (error) {
        toast({ title: "Could not remove uploaded file", description: error.message, variant: "destructive" });
        return;
      }
    }
    setMedia(null); onMediaChange(null);
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium">Evidence Upload</div>
      {!media && <div className="flex space-x-2 mb-2">
        <Button type="button" variant={activeTab === 'image' ? "default" : "outline"} size="sm" onClick={() => setActiveTab('image')}><Camera className="h-4 w-4 mr-1" />Photo</Button>
        <Button type="button" variant={activeTab === 'audio' ? "default" : "outline"} size="sm" onClick={() => setActiveTab('audio')}><Mic className="h-4 w-4 mr-1" />Audio</Button>
        <Button type="button" variant={activeTab === 'video' ? "default" : "outline"} size="sm" onClick={() => setActiveTab('video')}><Video className="h-4 w-4 mr-1" />Video</Button>
      </div>}
      {!media && <div className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-md p-6 bg-gray-50">
        <label htmlFor="file-upload" className="cursor-pointer w-full">
          <div className="flex flex-col items-center space-y-2">
            {activeTab === 'image' && <Camera className="h-8 w-8 text-gray-400" />}
            {activeTab === 'audio' && <Mic className="h-8 w-8 text-gray-400" />}
            {activeTab === 'video' && <Video className="h-8 w-8 text-gray-400" />}
            <span className="text-sm font-medium text-gray-600">{activeTab === 'image' ? 'Upload a photo' : activeTab === 'audio' ? 'Upload an audio recording' : 'Upload a video'}</span>
            <span className="text-xs text-gray-400">Files up to 50 MB · upload path scoped to your account</span>
          </div>
          <Input id="file-upload" type="file" accept={activeTab === 'image' ? 'image/*' : activeTab === 'audio' ? 'audio/*' : 'video/*'} onChange={event => void handleFileUpload(event, activeTab)} className="hidden" disabled={isUploading} />
        </label>
      </div>}
      {isUploading && <div className="border rounded-md p-6 bg-gray-50"><div className="flex flex-col items-center space-y-2"><div className="animate-pulse flex space-x-2 items-center"><div className="h-2 w-2 bg-civic-blue rounded-full" /><div className="h-2 w-2 bg-civic-blue rounded-full" /><div className="h-2 w-2 bg-civic-blue rounded-full" /></div><span className="text-sm text-gray-600">Uploading {activeTab} to Civic Pulse...</span></div></div>}
      {media && !isUploading && <div className="relative border rounded-md p-2 bg-gray-50">
        <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => void clearMedia()}><X className="h-4 w-4" /></Button>
        {media.type === 'image' && <img src={media.url} alt="Uploaded evidence" className="w-full h-auto rounded-md max-h-48 object-cover mt-2" />}
        {media.type === 'audio' && <div className="pt-6 pb-2"><audio controls className="w-full"><source src={media.url} type={media.file.type} />Your browser does not support audio playback.</audio></div>}
        {media.type === 'video' && <div className="pt-6 pb-2"><video controls className="w-full max-h-48 object-contain"><source src={media.url} type={media.file.type} />Your browser does not support video playback.</video></div>}
        <div className="text-xs text-gray-500 mt-2">{media.file.name} ({(media.file.size / 1024).toFixed(1)} KB)</div>
      </div>}
    </div>
  );
};
export default MultiMediaUploader;
