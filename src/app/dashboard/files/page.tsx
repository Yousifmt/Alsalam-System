
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, MoreHorizontal, FileText, Download, Trash2, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/auth-context";
import React, { useState, useRef, useEffect } from "react";
import { deleteFile, getFiles, uploadFile } from "@/services/file-service";
import type { ManagedFile } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const getBadgeVariant = (access: string) => {
    switch (access) {
        case "Public": return "secondary";
        default: return "default";
    }
}

export default function FilesPage() {
    const { role } = useAuth();
    const { toast } = useToast();
    const [files, setFiles] = useState<ManagedFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deletingFile, setDeletingFile] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchFiles = async () => {
        setLoading(true);
        try {
            const fetchedFiles = await getFiles();
            setFiles(fetchedFiles);
        } catch (error) {
            console.error("Error fetching files:", error);
            toast({ title: "Error", description: "Failed to fetch files.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, []);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setUploading(true);
            try {
                await uploadFile(file);
                toast({ title: "Success", description: "File uploaded successfully." });
                await fetchFiles(); // Refresh the file list
            } catch (error) {
                console.error("Error uploading file:", error);
                toast({ title: "Error", description: "Failed to upload file.", variant: "destructive" });
            } finally {
                setUploading(false);
                // Reset the file input
                if(fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            }
        }
    };

    const handleDeleteFile = async (filePath: string) => {
        if (!confirm("Are you sure you want to delete this file? This action cannot be undone.")) {
            return;
        }
        setDeletingFile(filePath);
        try {
            await deleteFile(filePath);
            toast({ title: "Success", description: "File deleted successfully." });
            setFiles(files.filter(f => f.path !== filePath));
        } catch (error) {
            console.error("Error deleting file:", error);
            toast({ title: "Error", description: "Failed to delete file.", variant: "destructive" });
        } finally {
            setDeletingFile(null);
        }
    };

    const isStudent = role === 'student';

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline">{isStudent ? "Files" : "File Management"}</h1>
                    <p className="text-muted-foreground">{isStudent ? "download shared files" : "Upload, view, and manage your shared files."}</p>
                </div>
                {role === 'admin' && (
                    <>
                        <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleUploadClick} disabled={uploading}>
                            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                            {uploading ? "Uploading..." : "Upload File"}
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            disabled={uploading}
                        />
                    </>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Files</CardTitle>
                    <CardDescription>A list of all files you have access to.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                         <div className="flex justify-center items-center p-8 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin"/>
                            <p className="ml-4">Loading files...</p>
                        </div>
                    ) : files.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="hidden md:table-cell">Size</TableHead>
                                    <TableHead>Access Level</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {files.map((file) => (
                                    <TableRow key={file.path}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-3">
                                                <FileText className="h-5 w-5 text-muted-foreground" />
                                                <span>{file.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">{file.size}</TableCell>
                                        <TableCell>
                                            <Badge variant={getBadgeVariant("Public")}>Public</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button aria-haspopup="true" size="icon" variant="ghost" disabled={deletingFile === file.path}>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="sr-only">Toggle menu</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 cursor-pointer">
                                                            <Download className="h-4 w-4"/>Download
                                                        </a>
                                                    </DropdownMenuItem>
                                                    {role === 'admin' && (
                                                        <>
                                                        <DropdownMenuItem 
                                                            onClick={() => handleDeleteFile(file.path)} 
                                                            className="flex items-center gap-2 text-red-500 hover:text-red-500 focus:text-red-500"
                                                            disabled={deletingFile === file.path}
                                                        >
                                                            {deletingFile === file.path ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
                                                            {deletingFile === file.path ? 'Deleting...' : 'Delete'}
                                                        </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center text-muted-foreground p-8">
                            <p>
                                {role === 'admin'
                                    ? "You haven't uploaded any files yet."
                                    : "No files have been shared with you."}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
