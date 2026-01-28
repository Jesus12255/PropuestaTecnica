import { useState, useEffect, useRef } from 'react';
import { storageService } from '../services/storageService';
import type { RFPFile } from '../types';

interface CachedFile {
    url: string;
    type: string;
    loading: boolean;
}

export const useFilePreloader = (files: RFPFile[] = [], citations: string[] = []) => {
    // Cache: fileId -> { url, type, loading }
    const cache = useRef<Map<string, CachedFile>>(new Map());
    // Force re-render when cache updates (optional, mainly if we want to show loading status)
    const [, setTick] = useState(0);

    useEffect(() => {
        const preloadFiles = async () => {
            if (!files.length || !citations.length) return;

            // 1. Identify files to preload based on citations
            const filesToPreload = new Set<RFPFile>();
            
            citations.forEach(citation => {
                if (!citation) return;
                const parts = citation.split(',');
                if (parts.length > 0) {
                    const filenameRaw = parts[0].trim().toLowerCase();
                    // Match logic similar to SourceBadge
                    let targetFile = files.find(f => 
                        (f.nombre || f.filename || '').toLowerCase() === filenameRaw
                    );
                     // Fallback check: contains
                    if (!targetFile) {
                         targetFile = files.find(f => {
                            const fName = (f.nombre || f.filename || '').toLowerCase();
                            return fName.includes(filenameRaw) || filenameRaw.includes(fName);
                        });
                    }

                    if (targetFile) {
                        filesToPreload.add(targetFile);
                    }
                }
            });

            // 2. Fetch files that are not in cache
            for (const file of filesToPreload) {
                const fileId = file.archivo_id || file.id;
                if (!fileId) continue;

                if (!cache.current.has(fileId)) {
                    // Mark as loading
                    cache.current.set(fileId, { url: '', type: '', loading: true });
                    
                    try {
                        console.log(`Preloading file: ${file.nombre || file.filename}`);
                        const result = await storageService.getFileViewUrl(fileId);
                        cache.current.set(fileId, { ...result, loading: false });
                    } catch (error) {
                        console.error(`Failed to preload ${fileId}`, error);
                        cache.current.delete(fileId); // Retry next time? Or leave as error?
                    }
                }
            }
            setTick(t => t + 1);
        };

        preloadFiles();

        // Cleanup function
        return () => {
            // Revoke all blob URLs on unmount
            cache.current.forEach((value) => {
                if (value.url && value.url.startsWith('blob:')) {
                    URL.revokeObjectURL(value.url);
                }
            });
            cache.current.clear();
        };
    }, [files, citations]); // Re-run if files or citations change

    /**
     * Get a file URL. If cached, returns immediately.
     * If not, fetches it (and caches it).
     */
    const getFileUrl = async (fileId: string): Promise<{ url: string; type: string }> => {
        const cached = cache.current.get(fileId);
        
        // If already loaded, return it
        if (cached && !cached.loading && cached.url) {
            return { url: cached.url, type: cached.type };
        }

        // If currently loading, wait for it (simple polling for now, or could use promises map)
        if (cached && cached.loading) {
            // Wait for it to finish? 
            // For simplicity, we'll just await the service call again (storageService might not dedupe, but it's safe)
            // Or better: trust the service call.
             // Actually, if it's loading, we might race. 
             // Let's just call the service directly if not fully ready. The browser cache might help, 
             // but since we use Blob, meaningful deduping is harder without a promise cache.
             // Let's stick to: "If not ready, fetch fresh".
        }

        // Fetch fresh
        const result = await storageService.getFileViewUrl(fileId);
        // Cache it for next time
        if (!cache.current.has(fileId)) {
             cache.current.set(fileId, { ...result, loading: false });
        }
        return result;
    };

    return { getFileUrl };
};
