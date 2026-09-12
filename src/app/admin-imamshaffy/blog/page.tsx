
'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, Loader2 } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { BlogPost } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

function PostRowSkeleton() {
    return (
        <TableRow>
            <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
            <TableCell><Skeleton className="h-6 w-20" /></TableCell>
            <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
        </TableRow>
    );
}

export default function AdminBlogPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [postToDelete, setPostToDelete] = React.useState<BlogPost | null>(null);

    const postsQuery = useMemoFirebase(
        () => query(collection(firestore, 'blogPosts'), orderBy('createdAt', 'desc')),
        [firestore]
    );
    const { data: posts, isLoading } = useCollection<BlogPost>(postsQuery);
    
    const handleDeletePost = async () => {
        if (!postToDelete || !firestore) return;

        try {
            await deleteDoc(doc(firestore, 'blogPosts', postToDelete.id));
            toast({ variant: 'success', title: 'Post Deleted', description: `"${postToDelete.title}" has been deleted.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the post.' });
        } finally {
            setPostToDelete(null);
        }
    };

    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Blog Management</h1>
                    <p className="text-muted-foreground">Create, edit, and manage your blog posts.</p>
                </div>
                <Button asChild>
                    <Link href="/admin-imamshaffy/blog/editor?id=create">
                        <PlusCircle className="mr-2 h-4 w-4" /> Create New Post
                    </Link>
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>All Posts</CardTitle>
                    <CardDescription>A list of all blog posts on the platform.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="hidden md:table-cell">Created</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <PostRowSkeleton />
                                <PostRowSkeleton />
                                <PostRowSkeleton />
                            </TableBody>
                        </Table>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="hidden md:table-cell">Created</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {posts && posts.length > 0 ? (
                                    posts.map(post => (
                                        <TableRow key={post.id}>
                                            <TableCell className="font-medium max-w-sm whitespace-normal break-words">{post.title}</TableCell>
                                            <TableCell>
                                                <Badge variant={post.published ? 'default' : 'secondary'}>
                                                    {post.published ? 'Published' : 'Draft'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                {post.createdAt ? format(post.createdAt.toDate(), 'PPP') : 'N/A'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="outline" size="sm" asChild className="mr-2">
                                                    <Link href={`/admin-imamshaffy/blog/editor?id=${post.id}`}>
                                                        <Edit className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                                <Button variant="destructive" size="sm" onClick={() => setPostToDelete(post)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            No posts found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={!!postToDelete} onOpenChange={(open) => !open && setPostToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the post titled "<strong>{postToDelete?.title}</strong>". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeletePost} className="bg-destructive hover:bg-destructive/90">Delete Post</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
