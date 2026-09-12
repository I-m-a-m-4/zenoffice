'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Bot, ChevronRight, Loader2, User, Send } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

type Message = {
    sender: 'user' | 'ai';
    text: string;
};

interface AIChatProps {
    messages: Message[];
    input: string;
    onInputChange: (value: string) => void;
    onSendMessage: (e: React.FormEvent) => void;
    isLoading: boolean;
    className?: string;
}

export default function AIChat({ messages, input, onInputChange, onSendMessage, isLoading, className }: AIChatProps) {
    const scrollAreaRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
            }
        }
    }, [messages]);

    return (
        <div className={`flex flex-col gap-4 overflow-hidden ${className}`}>
            <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
                <div className="space-y-4">
                {messages.map((message, index) => (
                    <div key={index} className={`flex items-start gap-3 ${message.sender === 'user' ? 'justify-end' : ''}`}>
                        {message.sender === 'ai' && (
                            <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                                <AvatarFallback><Bot /></AvatarFallback>
                            </Avatar>
                        )}
                        <div className={`rounded-lg p-3 max-w-[80%] whitespace-pre-wrap ${message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            <p className="text-sm">{message.text}</p>
                        </div>
                        {message.sender === 'user' && (
                            <Avatar className="h-8 w-8">
                                <AvatarFallback><User /></AvatarFallback>
                            </Avatar>
                        )}
                    </div>
                ))}
                 {isLoading && (
                    <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                            <AvatarFallback><Bot /></AvatarFallback>
                        </Avatar>
                        <div className="rounded-lg p-3 bg-muted flex items-center">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    </div>
                 )}
                </div>
            </ScrollArea>
            <form onSubmit={onSendMessage} className="flex w-full items-center gap-2">
                <Input
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    placeholder="Ask Zen AI, or ask it to add a product..."
                    disabled={isLoading}
                    className="flex-1"
                />
                <Button type="submit" disabled={isLoading || !input.trim()}>
                   <Send className="h-5 w-5"/>
                </Button>
            </form>
        </div>
    );
}
