
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject, getMetadata } from "firebase/storage";
import type { ManagedFile } from "@/lib/types";

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export async function uploadFile(file: File): Promise<void> {
    const storageRef = ref(storage, `shared_files/${file.name}`);
    await uploadBytes(storageRef, file);
}

export async function getFiles(): Promise<ManagedFile[]> {
    const listRef = ref(storage, 'shared_files');
    const res = await listAll(listRef);
    
    const files = await Promise.all(res.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        const metadata = await getMetadata(itemRef);
        return {
            name: itemRef.name,
            size: formatBytes(metadata.size),
            url,
            path: itemRef.fullPath,
        };
    }));

    return files;
}

export async function deleteFile(filePath: string): Promise<void> {
    const fileRef = ref(storage, filePath);
    await deleteObject(fileRef);
}
