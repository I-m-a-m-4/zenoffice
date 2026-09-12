'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import MarketingHeader from "@/components/layout/marketing-header";
import MarketingFooter from "@/components/layout/marketing-footer";
import { Button } from "@/components/ui/button";
import { InteractiveGrid } from '@/components/interactive-grid';
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  ChevronRight,
  TrendingUp,
  Zap,
  PartyPopper,
  CheckCircle2,
  MapPin,
  ArrowRight,
  Loader2,
  Sparkles,
  Barcode,
  Package,
  Box,
  Tag,
  Receipt
} from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

const hqImages = [
  "/zeneva_hq_1.png",
  "/zeneva_hq_2.png",
  "/zeneva_hq_3.png"
];

const values = [
  {
    title: "You will work with the best people.",
    description: "Zenevans are incredibly hard-working and supportive people who want to see you succeed beyond your team.",
    icon: Users,
    bgColor: "bg-orange-100",
    iconColor: "text-orange-600",
    hoverBg: "bg-[#FFF7ED]" // Light Orange
  },
  {
    title: "Your career growth is guaranteed.",
    description: "We are dedicated to ensuring your career growth. Get to work on fun projects, take relevant courses and broaden your skills.",
    icon: Zap,
    bgColor: "bg-pink-100",
    iconColor: "text-pink-600",
    hoverBg: "bg-[#FFF1F2]" // Light Pink
  },
  {
    title: "Explore your skills and creativity.",
    description: "There's an enabling environment for you to explore your creativity and explore other skills at Zeneva.",
    icon: TrendingUp,
    bgColor: "bg-blue-100",
    iconColor: "text-blue-600",
    hoverBg: "bg-[#EFF6FF]" // Light Blue
  },
  {
    title: "Benefit from the best perks.",
    description: "We offer competitive compensation, healthcare, paid time off, and the chance to own equity in the future of commerce.",
    icon: PartyPopper,
    bgColor: "bg-green-100",
    iconColor: "text-emerald-600",
    hoverBg: "bg-[#F0FDF4]" // Light Green
  }
];

const jobs = [
  {
    id: "marketing-lead",
    title: "Marketing Team Lead",
    department: "Growth",
    location: "Lagos",
    type: "Full-time",
    description: "Drive Zeneva's global marketing strategy and lead our growth initiatives."
  },
  {
    id: "ambassador",
    title: "Community Ambassador",
    department: "Growth",
    location: "Global",
    type: "Contract",
    description: "Represent Zeneva in your local market and build vibrant merchant communities."
  },
  {
    id: "sales-rep",
    title: "Sales Representative",
    department: "Growth",
    location: "Nigeria",
    type: "Contract",
    description: "The boots on the ground helping retailers digitize their operations with Zeneva."
  }
];

export default function CareersPage() {
  const [selectedJob, setSelectedJob] = useState<typeof jobs[0] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentHqImage, setCurrentHqImage] = useState(0);
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHqImage((prev) => (prev + 1) % hqImages.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const handleApply = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedJob) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const application = {
      jobId: selectedJob.id,
      jobTitle: selectedJob.title,
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      pitch: formData.get('pitch'),
      portfolio: formData.get('portfolio'),
      createdAt: serverTimestamp(),
      status: 'pending'
    };

    try {
      await addDoc(collection(firestore, 'job_applications'), application);
      toast({
        variant: 'success',
        title: 'Application Received!',
        description: "Your application has been submitted successfully. We'll be in touch!",
      });
      setSelectedJob(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: 'Something went wrong. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

      <main className="relative">
        <div className="fixed inset-0 grid-lines w-full h-full top-[var(--tauri-title-height,0)] pointer-events-none z-0 opacity-[0.15]"></div>
        
        {/* Hero Section with Interactive Grid Pattern */}
        <section className="relative flex items-center justify-center px-6 pt-48 pb-20 md:py-48 overflow-hidden bg-transparent">
          <div className="absolute inset-0 z-0">
            <InteractiveGrid />
            <div className="aura-background"></div>
            
            {/* Doodle Icons */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-25">
              <motion.div 
                animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[25%] left-[22%]"
              >
                <Barcode className="w-12 h-12 text-slate-400" />
              </motion.div>
              <motion.div 
                animate={{ y: [0, 20, 0], rotate: [0, -10, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute top-[35%] right-[22%]"
              >
                <Package className="w-10 h-10 text-slate-400" />
              </motion.div>
              <motion.div 
                animate={{ y: [0, -15, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute bottom-[35%] left-[25%]"
              >
                <Box className="w-8 h-8 text-slate-400" />
              </motion.div>
              <motion.div 
                animate={{ y: [0, 25, 0], rotate: [0, 15, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
                className="absolute bottom-[30%] right-[25%]"
              >
                <Tag className="w-14 h-14 text-slate-400" />
              </motion.div>
              <motion.div 
                animate={{ opacity: [0.3, 0.6, 0.3], y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[50%] left-[18%]"
              >
                <Receipt className="w-10 h-10 text-slate-400" />
              </motion.div>
            </div>
          </div>
          
          <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Sparkles className="h-4 w-4 text-slate-900 fill-slate-900" />
              <span className="text-sm font-semibold tracking-tight text-slate-900 uppercase">Strategic Growth</span>
            </div>
            
            <h1 className="text-5xl md:text-8xl font-black tracking-tight leading-[0.95] text-slate-950 font-dm-sans">
              Join the future <br />
              <span className="text-slate-500">of African retail.</span>
            </h1>
            
            <p className="text-lg md:text-2xl text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed font-dm-sans">
              Zeneva is the operating system for a new era of commerce. Join our mission to empower millions of merchants across the continent.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Button asChild size="lg" className="bg-[#1e293b] hover:bg-[#0f172a] text-white rounded-md px-8 py-4 h-auto text-base font-medium tracking-tight shadow-sm transition-all">
                <Link href="#openings" className="font-dm-sans">Explore Openings</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-stone-200 bg-white text-slate-900 hover:text-slate-600 rounded-md px-8 py-4 h-auto text-base font-medium tracking-tight shadow-sm transition-all">
                <Link href="/about/our-mission" className="font-dm-sans">Our Mission</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Joint Vision & Culture Section (Login-style split) */}
        <section className="bg-white border-y border-slate-50">
          <div className="grid grid-cols-1 lg:grid-cols-[0.7fr_1.3fr] min-h-[500px]">
            {/* Left Side: Culture & Values */}
            <div className="flex flex-col justify-center p-8 md:p-12 lg:p-16 bg-white shrink-0">
              <div className="max-w-xl">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 font-dm-sans mb-3 tracking-tight">Why work with us?</h2>
                <p className="text-slate-500 font-dm-sans mb-8 text-base">Because the smartest and most talented people in tech are building the future at Zeneva.</p>
                
                <div className="grid grid-cols-1 gap-4">
                  {values.map((value, index) => (
                    <div 
                      key={index} 
                      className="group relative p-5 bg-white border-2 border-dashed border-slate-200 rounded-xl overflow-hidden transition-all duration-500 isolate cursor-pointer hover:border-primary/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 ${value.bgColor} ${value.iconColor} rounded-lg flex items-center justify-center shrink-0 relative z-10`}>
                          <value.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 relative z-10 font-dm-sans tracking-tight">{value.title}</h3>
                          <p className="text-slate-500 text-sm leading-relaxed relative z-10 font-dm-sans">
                            {value.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-16 flex items-center gap-4">
                  <Link href="#openings" className="text-primary font-bold flex items-center gap-2 hover:underline font-dm-sans">
                    See Open Positions <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Side: Architectural Vision Slider */}
            <div className="relative overflow-hidden bg-slate-950 min-h-[400px] lg:min-h-full">
              <AnimatePresence>
                <motion.div
                  key={currentHqImage}
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                  className="absolute inset-0 w-full h-full"
                >
                  <img 
                    src={hqImages[currentHqImage]} 
                    alt={`Zeneva HQ ${currentHqImage + 1}`} 
                    className="w-full h-full object-cover"
                  />
                  {/* Deep Gradient Overlay for better text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                </motion.div>
              </AnimatePresence>

              {/* Slider Info Overlay */}
              <div className="absolute bottom-12 left-12 z-20">
                <h3 className="text-white text-3xl font-bold font-dm-sans mb-2 tracking-tight">The Zeneva Campus</h3>
                <p className="text-white/70 font-dm-sans text-lg max-w-sm">Designing the environment where African retail is redefined.</p>
                
                <div className="mt-6 flex items-center gap-3">
                  {hqImages.map((_, i) => (
                    <div 
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-500 ${i === currentHqImage ? 'w-12 bg-primary' : 'w-2 bg-white/30'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="openings" className="py-24 px-6 bg-white">
          <div className="max-w-5xl mx-auto bg-slate-50 rounded-[2rem] p-8 md:p-16">
            <div className="mb-10 text-left">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 font-dm-sans tracking-tight">Open Positions</h2>
            </div>
            
            <div className="space-y-6">
              {jobs.map((job) => (
                <div 
                  key={job.id} 
                  className="bg-white rounded-2xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 shadow-sm border-2 border-dashed border-slate-200 transition-all hover:shadow-md hover:border-primary/30"
                >
                  <div className="space-y-3 flex-1">
                    <h3 className="text-xl md:text-2xl font-bold text-slate-900 font-dm-sans">
                      {job.title}
                    </h3>
                    <p className="text-slate-600 text-[15px] leading-snug font-dm-sans max-w-2xl">
                      {job.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 font-dm-sans pt-1">
                      <span className="text-slate-500">{job.department}</span>
                      <span>•</span>
                      <span>{job.type}, {job.location}</span>
                    </div>
                  </div>
                  
                  <div className="shrink-0 w-full md:w-auto">
                    <Button 
                      onClick={() => setSelectedJob(job)}
                      className="bg-primary hover:bg-primary/90 text-white rounded-lg px-8 h-12 text-sm font-bold w-full md:w-auto transition-colors"
                    >
                      Apply Now
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-16 text-center">
              <p className="text-slate-500 font-dm-sans mb-4">Don't see a role that fits? We're always looking for geniuses.</p>
              <a href="mailto:careers@zeneva.space" className="text-emerald-600 font-bold flex items-center justify-center gap-2 hover:underline">
                careers@zeneva.space <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          </div>
        </section>

      </main>
      {/* Application Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="sm:max-w-[500px] rounded-xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-stone-950 p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Sparkles className="w-16 h-16 text-white" />
            </div>
            <DialogHeader className="relative z-10 text-left">
              <DialogTitle className="text-xl font-bold font-dm-sans text-white tracking-tight">Apply for {selectedJob?.title}</DialogTitle>
              <DialogDescription className="text-white/60 text-xs font-medium font-dm-sans mt-1">
                Tell us why you're the perfect fit for the Zeneva team.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <form onSubmit={handleApply} className="p-6 space-y-4 bg-white font-dm-sans">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="name" className="text-slate-900 font-bold text-[10px] uppercase tracking-wider">Full Name</Label>
                <Input id="name" name="name" required placeholder="John Doe" className="h-10 rounded-lg border-2 border-dashed border-slate-200 focus:border-primary focus:ring-0 transition-all bg-slate-50/50 text-sm" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email" className="text-slate-900 font-bold text-[10px] uppercase tracking-wider">Email Address</Label>
                <Input id="email" name="email" type="email" required placeholder="john@example.com" className="h-10 rounded-lg border-2 border-dashed border-slate-200 focus:border-primary focus:ring-0 transition-all bg-slate-50/50 text-sm" />
              </div>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="phone" className="text-slate-900 font-bold text-[10px] uppercase tracking-wider">Phone Number</Label>
              <Input id="phone" name="phone" required placeholder="+234 ..." className="h-10 rounded-lg border-2 border-dashed border-slate-200 focus:border-primary focus:ring-0 transition-all bg-slate-50/50 text-sm" />
            </div>
 
            <div className="space-y-1">
              <Label htmlFor="portfolio" className="text-slate-900 font-bold text-[10px] uppercase tracking-wider">Work Links / LinkedIn</Label>
              <Input id="portfolio" name="portfolio" required placeholder="https://..." className="h-10 rounded-lg border-2 border-dashed border-slate-200 focus:border-primary focus:ring-0 transition-all bg-slate-50/50 text-sm" />
            </div>
 
            <div className="space-y-1">
              <Label htmlFor="pitch" className="text-slate-900 font-bold text-[10px] uppercase tracking-wider">Short Pitch</Label>
              <Textarea id="pitch" name="pitch" required placeholder="Describe your relevant experience..." className="min-h-[100px] rounded-lg border-2 border-dashed border-slate-200 focus:border-primary focus:ring-0 transition-all bg-slate-50/50 p-3 text-sm resize-none" />
            </div>
 
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
            >

              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  Submit Application
                  <CheckCircle2 className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
            <p className="text-center text-xs text-slate-400 font-medium">By submitting, you agree to Zeneva's recruitment policy.</p>
          </form>
        </DialogContent>
      </Dialog>

      <MarketingFooter />
    </div>
  );
}
