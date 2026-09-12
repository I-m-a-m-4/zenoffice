
'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc, setDoc, addDoc, serverTimestamp, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

const blogPostSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters."),
    slug: z.string().min(3, "Slug must be a URL-friendly string.").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug can only contain lowercase letters, numbers, and hyphens."),
    excerpt: z.string().optional(),
    content: z.string().min(10, "Content is too short."),
    imageUrl: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
    published: z.boolean().default(false),
});

type BlogPostFormValues = z.infer<typeof blogPostSchema>;

function EditPostSkeleton() {
    return (
        <div className="grid flex-1 auto-rows-max gap-4">
             <div className="flex items-center gap-4">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-24" />
            </div>
            <Card><CardHeader><Skeleton className="h-6 w-32 mb-2"/><Skeleton className="h-4 w-48"/></CardHeader><CardContent><div className="grid gap-6"><Skeleton className="h-10 w-full"/><Skeleton className="h-10 w-full"/><Skeleton className="h-32 w-full"/><Skeleton className="h-40 w-full"/></div></CardContent></Card>
        </div>
    )
}

function EditBlogPostContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const postId = searchParams.get('id') || '';
    const isCreateMode = postId === 'create' || !postId;

    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    
    const [isLoading, setIsLoading] = React.useState(!isCreateMode);
    const [isSaving, setIsSaving] = React.useState(false);

    const form = useForm<BlogPostFormValues>({
        resolver: zodResolver(blogPostSchema),
        defaultValues: { title: "", slug: "", excerpt: "", content: "", imageUrl: "", published: false },
    });
    
    const generateSlug = (title: string) => {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric characters
            .trim()
            .replace(/\s+/g, '-') // replace spaces with hyphens
            .slice(0, 50); // limit length
    };

    React.useEffect(() => {
        const subscription = form.watch((value, { name }) => {
            if (name === 'title' && isCreateMode) {
                form.setValue('slug', generateSlug(value.title || ''));
            }
        });
        return () => subscription.unsubscribe();
    }, [form, isCreateMode]);

    React.useEffect(() => {
        if (!isCreateMode && firestore && postId) {
            const fetchPost = async () => {
                setIsLoading(true);
                try {
                    const postDocRef = doc(firestore, 'blogPosts', postId);
                    const docSnap = await getDoc(postDocRef);
                    if (docSnap.exists()) {
                        form.reset(docSnap.data() as BlogPostFormValues);
                    } else {
                        toast({ variant: 'destructive', title: 'Not Found', description: 'Blog post not found.' });
                        router.push('/admin-imamshaffy/blog');
                    }
                } catch (e) {
                    toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch blog post.' });
                } finally {
                    setIsLoading(false);
                }
            }
            fetchPost();
        }
    }, [isCreateMode, firestore, postId, form, toast, router]);

    const onSubmit = async (values: BlogPostFormValues) => {
        if (!firestore || !user) return;
        setIsSaving(true);
        
        try {
            if (isCreateMode) {
                await addDoc(collection(firestore, 'blogPosts'), {
                    ...values,
                    authorId: user.uid,
                    authorName: user.displayName || 'Admin',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
                toast({ variant: 'success', title: 'Post Created', description: 'Your new blog post has been saved.' });
            } else {
                const postDocRef = doc(firestore, 'blogPosts', postId);
                await setDoc(postDocRef, {
                    ...values,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
                toast({ variant: 'success', title: 'Post Updated', description: 'Your blog post has been updated.' });
            }
            router.push('/admin-imamshaffy/blog');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'An unexpected error occurred.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    if (isLoading) {
        return <EditPostSkeleton />;
    }
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" className="h-7 w-7" asChild>
                        <Link href="/admin-imamshaffy/blog">
                            <ChevronLeft className="h-4 w-4" />
                            <span className="sr-only">Back</span>
                        </Link>
                    </Button>
                    <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
                        {isCreateMode ? "Create New Blog Post" : "Edit Blog Post"}
                    </h1>
                    <div className="hidden items-center gap-2 md:ml-auto md:flex">
                        <Button variant="outline" size="lg" type="button" onClick={() => router.push('/admin-imamshaffy/blog')}>
                            Cancel
                        </Button>
                        <Button size="lg" type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isCreateMode ? 'Publish Post' : 'Save Changes'}
                        </Button>
                    </div>
                </div>

                 <Card>
                    <CardHeader>
                        <CardTitle>Post Details</CardTitle>
                        <CardDescription>Fill out the main content and metadata for your blog post.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="title" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Title</FormLabel>
                                <FormControl><Input placeholder="Your Awesome Post Title" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                         <FormField control={form.control} name="slug" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Slug</FormLabel>
                                <FormControl><Input placeholder="your-awesome-post-title" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="excerpt" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Excerpt</FormLabel>
                                <FormControl><Textarea placeholder="A short summary of your post." {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="content" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Content (Markdown supported)</FormLabel>
                                <FormControl><Textarea placeholder="Write your post content here..." className="min-h-64" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="imageUrl" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Image URL</FormLabel>
                                <FormControl><Input placeholder="https://example.com/image.png" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="published" render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel>Published</FormLabel>
                                    <FormMessage>Make this post visible to the public.</FormMessage>
                                </div>
                                <FormControl>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                            </FormItem>
                        )}/>
                    </CardContent>
                </Card>
                 <div className="flex items-center justify-center gap-2 md:hidden">
                    <Button variant="outline" size="lg" type="button" onClick={() => router.push('/admin-imamshaffy/blog')}>
                        Cancel
                    </Button>
                    <Button size="lg" type="submit" disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isCreateMode ? 'Publish Post' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </Form>
    );
}

export default function EditBlogPostPage() {
    return (
        <React.Suspense fallback={<EditPostSkeleton />}>
            <EditBlogPostContent />
        </React.Suspense>
    );
}
